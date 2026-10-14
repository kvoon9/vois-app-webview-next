#!/usr/bin/env python3
"""
qqctl — send QQ messages from the command line on macOS.

Delivery only needs the QQ app to be running and logged in. The flow is:

    AX (search box)  ->  pid-Enter (open the top result)  ->  clipboard + pid-Cmd-V
                     ->  pid-Enter (send)  ->  read the message list back to verify

Everything goes through the macOS Accessibility API or events addressed to QQ's
own process (CGEventPostToPid), so:

  * the mouse is never moved (no global mouse events at all — CGEventPostToPid is
    ignored by Chromium for clicks, and a global click would drag the cursor),
  * the user's keyboard is never touched (text arrives as a paste),
  * QQ never has to come to the front: key events are posted to QQ's pid, which
    works while another app owns the focus,
  * the clipboard is borrowed and restored.

Background worth keeping when editing:

  * AXValue writes text but **drops newline characters** in QQ's editor; a real
    paste keeps them.
  * QQ **deletes whitespace-only lines**, so the message format has no blank lines.
  * A modifier chord must press and release the real modifier key; setting only
    the CGEventFlags bit leaves Command stuck and the next Return arrives as
    Cmd+Return, which QQ treats as a newline instead of send.
  * QQ does not expose the conversation name for a group, and the group's 群公告
    editor is an AXTextArea too, so the message box is picked by window-relative
    geometry, not by index.
"""
import argparse
import json
import subprocess
import sys
import time

from axlib import app_for, children, describe, find, get, point, setv, size, walk
from ApplicationServices import (
    AXUIElementPerformAction,
    kAXDescriptionAttribute,
    kAXFocusedAttribute,
    kAXFrontmostAttribute,
    kAXRoleAttribute,
    kAXValueAttribute,
    kAXWindowsAttribute,
)
from AppKit import NSRunningApplication, NSWorkspace
from CoreFoundation import kCFBooleanTrue

SEND_KEY = 36
CMD_KEY = 55
CMD_FLAG = 1 << 20
ARROW_DOWN = 125

# ---------------------------------------------------------------- app lookup
def qq_pid():
    out = subprocess.run(['pgrep', '-x', 'QQ'], capture_output=True, text=True).stdout.split()
    if not out:
        raise SystemExit('QQ is not running')
    return int(out[0])


def app_el(pid):
    app = app_for(pid)
    setv(app, 'AXManualAccessibility', kCFBooleanTrue)
    return app


def win_of(app):
    windows = get(app, kAXWindowsAttribute)
    return windows[0] if windows else None


def window_state(app):
    """'visible' | 'minimized' | 'absent'.

    Chromium builds no accessibility tree for a hidden or minimized window, so an
    empty tree means the window is not on screen, not that QQ changed its UI.
    """
    windows = get(app, kAXWindowsAttribute) or []
    if not windows:
        return 'absent'
    for window in windows:
        if not get(window, 'AXMinimized'):
            return 'visible'
    return 'minimized'


def find_in(root, pred, maxdepth=60, budget=60000):
    return find(root, pred, maxdepth, budget)


def find_role(root, role):
    return [el for el, _ in find(root, lambda e, d: get(e, kAXRoleAttribute) == role, 60, 60000)]


def frontmost_name():
    app = NSWorkspace.sharedWorkspace().frontmostApplication()
    return app.localizedName() if app else None


# ---------------------------------------------------------------- AX readers
def message_box(app):
    """The conversation's message box, or None when no chat is open.

    Not "the first AXTextArea": a group's 群公告 editor is one too. The message
    box is the widest text area in the chat pane whose bottom touches the bottom
    of the window, measured relative to the window so a moved, resized or
    off-screen window keeps working.
    """
    window = win_of(app)
    origin, dims = point(window), size(window)
    if not origin or not dims:
        return None
    best = None
    for el in find_role(window, 'AXTextArea'):
        p, s = point(el), size(el)
        if not p or not s:
            continue
        rel_x, rel_y = p[0] - origin[0], p[1] - origin[1]
        if rel_x < 0.15 * dims[0]:
            continue
        if rel_y + s[1] < dims[1] - 0.15 * dims[1]:
            continue
        area = s[0] * s[1]
        if best is None or area > best[0]:
            best = (area, el)
    return best[1] if best else None


def search_field(app):
    els = find_role(win_of(app), 'AXTextField')
    return els[0] if els else None


def search_rows(app):
    """Search-result rows in visual order (top of the panel first)."""
    rows = []
    for el in find_role(win_of(app), 'AXMenuItem'):
        p, s = point(el), size(el)
        if not p or not s or not s[1]:
            continue
        value = str(get(el, kAXValueAttribute) or '')
        if value:
            rows.append((p[1], value, el))
    rows.sort()
    return [(value, el) for _, value, el in rows]


def header_name(app):
    """Open conversation's name when QQ exposes it (often empty for groups)."""
    box = message_box(app)
    if box is not None:
        desc = get(box, kAXDescriptionAttribute)
        if desc and str(desc).strip():
            return str(desc).strip()
    return None


def message_list_texts(app):
    out = []
    for group, _ in find_in(win_of(app), lambda e, d: get(e, kAXDescriptionAttribute) == '消息列表'):
        for el, _ in walk(group, 40, 40000):
            value, p = get(el, kAXValueAttribute), point(el)
            if value and p:
                out.append((p[1], str(value)))
    out.sort()
    return out


# ---------------------------------------------------------------- pid events
def pid_key(pid, code, flags=0, delay=0.04):
    """Press and release a key in QQ's process only, no matter who is frontmost."""
    from Quartz import CGEventCreateKeyboardEvent, CGEventPostToPid, CGEventSetFlags
    for down in (True, False):
        event = CGEventCreateKeyboardEvent(None, code, down)
        if flags:
            CGEventSetFlags(event, flags)
        CGEventPostToPid(pid, event)
        time.sleep(delay)


def pid_chord(pid, code, modifier=CMD_KEY, flag=CMD_FLAG):
    from Quartz import CGEventCreateKeyboardEvent, CGEventPostToPid, CGEventSetFlags

    def post(keycode, down, flags):
        event = CGEventCreateKeyboardEvent(None, keycode, down)
        CGEventSetFlags(event, flags)
        CGEventPostToPid(pid, event)
        time.sleep(0.04)

    post(modifier, True, flag)
    post(code, True, flag)
    post(code, False, flag)
    post(modifier, False, 0)
    time.sleep(0.05)


def system_chord(code, modifier=CMD_KEY, flag=CMD_FLAG, delay=0.04):
    """Chord through the system tap. Only used after QQ has been brought to the front."""
    from Quartz import CGEventCreateKeyboardEvent, CGEventPost, CGEventSetFlags, kCGSessionEventTap

    def post(keycode, down, flags):
        event = CGEventCreateKeyboardEvent(None, keycode, down)
        CGEventSetFlags(event, flags)
        CGEventPost(kCGSessionEventTap, event)
        time.sleep(delay)

    post(modifier, True, flag)
    post(code, True, flag)
    post(code, False, flag)
    post(modifier, False, 0)


def restore_frontmost(name):
    if not name or name == 'QQ':
        return
    for app in NSWorkspace.sharedWorkspace().runningApplications():
        if app.localizedName() == name:
            app.activateWithOptions_(1 << 1)
            return


# ---------------------------------------------------------------- clipboard
def clipboard_snapshot():
    from AppKit import NSPasteboard
    saved = []
    for item in (NSPasteboard.generalPasteboard().pasteboardItems() or []):
        data = {}
        for type_name in item.types():
            payload = item.dataForType_(type_name)
            if payload is not None:
                data[str(type_name)] = bytes(payload)
        saved.append(data)
    return saved


def clipboard_restore(saved):
    from AppKit import NSPasteboard, NSPasteboardItem
    board = NSPasteboard.generalPasteboard()
    board.clearContents()
    if not saved:
        return
    items = []
    for data in saved:
        item = NSPasteboardItem.alloc().init()
        for type_name, payload in data.items():
            item.setData_forType_(payload, type_name)
        items.append(item)
    board.writeObjects_(items)


def clipboard_put_text(text):
    from AppKit import NSPasteboard
    board = NSPasteboard.generalPasteboard()
    board.clearContents()
    board.setString_forType_(text, 'public.utf8-plain-text')


# ---------------------------------------------------------------- operations
def _norm(text):
    """Normalize a conversation name for matching.

    QQ truncates long names inside the search dropdown ("ai全自动发版本消...")
    and appends a member count to groups ("问题反馈群 (7人) 群聊"), so an exact
    string compare is not enough.
    """
    import re
    text = ''.join(str(text).split())
    text = text.replace('…', '').replace('...', '')
    text = re.sub(r'\(\d+人\)', '', text).replace('群聊', '')
    return text.strip()


def matches(name, row_value):
    """True when a dropdown row plausibly is `name` (either may be a prefix)."""
    a, b = _norm(name), _norm(row_value)
    if not a or not b:
        return False
    return a == b or b.startswith(a) or a.startswith(b)



def open_session(app, pid, name, timeout=8.0):
    """Open a conversation by name through QQ's search box."""
    if header_name(app) == name and message_box(app) is not None:
        return True, 'already open'

    box = search_field(app)
    if box is None:
        state = window_state(app)
        if state == 'visible':
            raise RuntimeError('search box not found in a visible QQ window; the UI may have changed, re-map it (references/qqctl.md)')
        raise RuntimeError(
            f"QQ's window is {state}: Chromium exposes no accessibility tree while it is hidden or "
            'minimized, so bring QQ up (click it or open -a QQ) and retry')
    AXUIElementPerformAction(box, 'AXPress')
    time.sleep(0.25)
    setv(box, kAXValueAttribute, '')
    time.sleep(0.2)
    setv(box, kAXValueAttribute, name)

    deadline = time.time() + timeout
    rows = []
    while time.time() < deadline:
        time.sleep(0.35)
        rows = [(value, el) for value, el in search_rows(app)
                if not value.startswith('进入综合搜索') and '相关聊天记录' not in value]
        if rows:
            break
    if not rows:
        return False, f'no search result for {name!r}'

    # Enter opens the highlighted row, which is the top one. Prefer a row that
    # really matches the requested name and walk down with arrow keys if needed.
    index = 0
    for i, (value, _) in enumerate(rows):
        if matches(name, value):
            index = i
            break
    for _ in range(index):
        pid_key(pid, ARROW_DOWN)
        time.sleep(0.1)
    pid_key(pid, SEND_KEY)
    pressed = rows[index][0]

    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(0.35)
        if message_box(app) is None or get(search_field(app), kAXValueAttribute):
            continue
        current = header_name(app)
        if current is None:
            return True, f'opened {pressed!r} (name not exposed)'
        if matches(name, current):
            return True, f'opened {current!r}'
        # A different conversation answered; keep waiting inside the deadline
        # instead of sending into the wrong chat.
    return False, f'pressed {pressed!r} but {header_name(app)!r} is open'


def qq_text(value):
    """QQ deletes whitespace-only lines, so compare with them removed."""
    return '\n'.join(line.rstrip() for line in (value or '').split('\n') if line.strip())


def _paste_attempts(app, pid, text, box, attempts, pause, global_paste):
    got = ''
    for attempt in range(attempts):
        AXUIElementPerformAction(box, 'AXPress')
        setv(box, kAXFocusedAttribute, kCFBooleanTrue)
        time.sleep(0.3)
        if attempt:
            setv(box, kAXValueAttribute, '')
            time.sleep(0.25)
        if global_paste:
            # A system-tap chord lands in whatever app is frontmost. Never post
            # one without verifying QQ is still there — otherwise the message
            # gets pasted into the user's editor or terminal.
            if frontmost_name() != 'QQ':
                return False, 'QQ is not frontmost; refusing to post a system keystroke'
            system_chord(9)
        else:
            pid_chord(pid, 9)
        time.sleep(pause)
        got = get(box, kAXValueAttribute) or ''
        if qq_text(got) == qq_text(text):
            return True, f'lines={len(got.splitlines())} attempts={attempt + 1}'
    return False, f'lines={len(got.splitlines())} input={got[:48]!r}'


def write_message(app, pid, text, attempts=2, pause=0.7):
    """Paste the text into the message box. Newlines survive; AXValue would drop them.

    Two tiers: key events addressed to QQ's process work while the user is in
    another app, but Chromium only accepts them while QQ's window is still key.
    When it is not — the user clicked elsewhere since QQ last had focus — the app
    is brought to the front just for the paste and the previous app is restored.
    """
    box = message_box(app)
    if box is None:  # the AX tree can lag behind a just-opened conversation
        for _ in range(6):
            time.sleep(0.4)
            box = message_box(app)
            if box is not None:
                break
    if box is None:
        return False, 'input box not found'

    draft = (get(box, kAXValueAttribute) or '').strip()
    if draft:
        return False, f'message box already has text ({draft[:24]!r}); refusing to overwrite'

    saved = clipboard_snapshot()
    try:
        clipboard_put_text(text)
        time.sleep(0.2)

        ok, detail = _paste_attempts(app, pid, text, box, attempts, pause, global_paste=False)
        if ok:
            return True, f'paste(pid) {detail}'

        # Ask macOS to activate QQ. Even when the request is refused and the app
        # never comes to the front, it usually still hands QQ's window key status,
        # which is all the pid-addressed keys need. Never a system keystroke here.
        activate_qq(pid, timeout=6.0)
        box = message_box(app) or box
        ok, detail = _paste_attempts(app, pid, text, box, attempts, pause, global_paste=False)
        if ok:
            return True, f'paste(pid, after focus nudge) {detail}'

        # Last resort, and only while QQ really owns the focus.
        if frontmost_name() == 'QQ':
            ok, detail = _paste_attempts(app, pid, text, box, attempts, pause, global_paste=True)
            if ok:
                return True, f'paste(system, QQ frontmost) {detail}'
        return False, (f'{detail} — QQ could not be focused automatically; '
                       'click QQ once and retry (nothing was typed into any other app)')
    finally:
        clipboard_restore(saved)


def send_message(pid):
    pid_key(pid, SEND_KEY)
    return True


def wait_sent(app, text, timeout=6.0):
    token = next((line.strip() for line in text.split('\n') if line.strip()), '')
    token = token[:16]
    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(0.4)
        if any(token in value for _, value in message_list_texts(app)):
            return True
    return False


# ---------------------------------------------------------------- optional
def activate_qq(pid, timeout=20.0):
    """Fallback only: focus the app when pid-addressed events are not enough.

    macOS treats focus changes from a background process as requests and refuses
    them while the user is typing elsewhere, so this rotates through the APIs.
    """
    from AppKit import NSApplicationActivateAllWindows, NSApplicationActivateIgnoringOtherApps
    flags = NSApplicationActivateAllWindows | NSApplicationActivateIgnoringOtherApps
    app = app_el(pid)
    deadline = time.time() + timeout
    attempt = 0
    while time.time() < deadline:
        if frontmost_name() == 'QQ':
            return True
        runner = NSRunningApplication.runningApplicationWithProcessIdentifier_(pid)
        if runner is None:
            return False
        try:
            runner.unhide()
            runner.activateWithOptions_(flags)
            setv(app, kAXFrontmostAttribute, kCFBooleanTrue)
        except Exception:
            pass
        if attempt % 3 == 1:
            subprocess.run(['open', '-a', '/Applications/QQ.app'], capture_output=True)
        elif attempt % 3 == 2:
            subprocess.run(['osascript', '-e', f'tell application "System Events" to set frontmost of '
                                              f'(first process whose unix id is {pid}) to true'], capture_output=True)
        attempt += 1
        time.sleep(0.8)
    return frontmost_name() == 'QQ'


# ---------------------------------------------------------------- cli
def cmd_send(args):
    pid = qq_pid()
    app = app_el(pid)
    previous = frontmost_name()
    steps = []
    ok, info = open_session(app, pid, args.session)
    steps.append(['open_session', ok, info])
    if not ok:
        return {'ok': False, 'steps': steps}
    ok, info = write_message(app, pid, args.text)
    steps.append(['write', ok, info])
    if not ok:
        return {'ok': False, 'steps': steps}
    send_message(pid)
    steps.append(['send', True, ''])
    sent = wait_sent(app, args.text)
    steps.append(['verify', sent, ''])
    # Never leave the user's focus somewhere else than we found it.
    if previous and previous != 'QQ' and frontmost_name() == 'QQ':
        restore_frontmost(previous)
    return {'ok': sent, 'steps': steps}


def cmd_open(args):
    pid = qq_pid()
    app = app_el(pid)
    ok, info = open_session(app, pid, args.session)
    return {'ok': ok, 'header': header_name(app), 'info': info}


def cmd_read(args):
    app = app_el(qq_pid())
    messages = [value for _, value in message_list_texts(app)]
    return {'ok': True, 'header': header_name(app), 'messages': messages[-args.limit:]}


def cmd_header(args):
    app = app_el(qq_pid())
    box = message_box(app)
    return {'ok': True, 'header': header_name(app),
            'draft': (get(box, kAXValueAttribute) or '') if box is not None else None}


def main():
    parser = argparse.ArgumentParser(prog='qqctl', description=__doc__.split('\n')[1])
    sub = parser.add_subparsers(dest='cmd', required=True)
    send = sub.add_parser('send')
    send.add_argument('session')
    send.add_argument('text')
    send.set_defaults(fn=cmd_send)
    open_ = sub.add_parser('open')
    open_.add_argument('session')
    open_.set_defaults(fn=cmd_open)
    read = sub.add_parser('read')
    read.add_argument('--limit', type=int, default=15)
    read.set_defaults(fn=cmd_read)
    sub.add_parser('header').set_defaults(fn=cmd_header)
    args = parser.parse_args()
    result = args.fn(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get('ok') else 1


if __name__ == '__main__':
    sys.exit(main())
