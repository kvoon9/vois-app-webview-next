# qqctl — driving QQ for macOS from the CLI

`scripts/qq/qqctl` sends a message to a QQ conversation on this Mac. It is the delivery step of this skill and nothing else depends on it.

```sh
./scripts/qq/qqctl send "ai 全自动发版本消息测试" "多行\n消息"   # send; JSON result, exit 1 on failure
./scripts/qq/qqctl open "问题反馈群"              # open a conversation, send nothing
./scripts/qq/qqctl read --limit 10               # read the open conversation's messages
./scripts/qq/qqctl header                        # current conversation name + draft text
```

`send` returns `{ok, steps}` where each step is `[name, ok, detail]` — `open_session`, `write`, `send`, `verify`. `verify` re-reads QQ's own message list, so `ok: true` means the message is really in the conversation, not that keystrokes were sent.

## How it works

QQ for macOS is Electron/Chromium. Chromium builds no accessibility tree until an assistive client asks, and the Electron-specific switch for that is the `AXManualAccessibility` attribute on the application element. Setting it makes the whole web UI visible through the macOS Accessibility API:

| target               | AX element                                                      |
| -------------------- | --------------------------------------------------------------- |
| conversation list    | `AXGroup[desc=会话列表]`                                        |
| search field         | `AXTextField` (first one in the window)                         |
| search dropdown rows | `AXMenuItem` inside the window, non-zero size                   |
| open conversation    | the message box's `AXDescription` — it is the conversation name |
| message list         | `AXGroup[desc=消息列表]`                                        |
| message box          | `AXTextArea`                                                    |
| input toolbar        | `AXToolbar` (screenshot / file / chat history)                  |

Steps of one `send`:

1. **Put a window on screen.** Chromium builds its accessibility tree per window, so a minimized or closed QQ window reads as an empty tree and every lookup below comes back empty. `ensure_window` calls `open -a QQ` and waits, then falls back to un-minimizing through AX if the window is still hidden. QQ keeps running with no window after its last one is closed, which is why this is the driver's job and not the caller's. The two states are **not** equally repairable:
   - **closed (`absent`)** — verified end to end: the window is recreated and comes back with key status, so the search press and the paste both land (`paste(pid)`, first attempt).
   - **minimized** — repaired and delivered in the verified run: `open -a QQ` brings the window back, the activation request that follows gets key status, the paste lands and the focus is handed back. Not guaranteed: `open -a` does not always win the focus for a window that already exists, and a window that only AX un-minimized is visible while keyless — the press can still open the conversation, then the paste fails and one click is what fixes it. `AXMain`/`AXFocusedWindow` reading `true` does not mean the window took keys.
     Both states get one bounded activation request before anything is pressed, which is the same trick step 3 uses for the paste.
2. **Open the conversation.** `AXPress` on the search field, write the name with an `AXValue` set, wait for the result rows, then one **pid-addressed Return** — QQ's dropdown highlights the top result, so Return opens it. Rows read `问题反馈群 (7人) 群聊`, so the match is "row value starts with the requested name"; when the name matches a lower row, the highlight is walked down with pid-addressed arrow keys first. Nothing here needs QQ to be frontmost. A press the dropdown ignored is retried once, again after a key-status nudge; a name with no search result is not retried, since that means a wrong name or no local history.
3. **Write the message.** Paste, never `AXValue`: Chromium's AX value setter **drops newline characters** in QQ's editor, so a multi-line message would arrive as one long line. The clipboard is snapshotted first and restored after the paste.
   Retries are always **pid-addressed**. When they do not land — Chromium drops key events once QQ's window has lost key status, which happens when the user clicks another app — the driver asks macOS to activate QQ first. Even a refused activation request usually returns key status to QQ's window, and the step detail says which attempt worked (`paste(pid)` / `paste(pid, after focus nudge)`).
4. **Send.** One pid-addressed Return. QQ's input area exposes no send button in the AX tree, so a key is the only way. QQ deletes whitespace-only lines but keeps every other break, which is why the message format has no blank lines.
5. **Verify** by reading the message list back, comparing text with whitespace-only lines removed (QQ deletes them).

## Interference model

- **No focus stealing in the normal path.** Key events are addressed to QQ's process with `CGEventPostToPid`, which Chromium accepts while another app owns the focus, so a `send` runs with the frontmost application unchanged (measured: ~9 s for a full send to a group). The recovered-window path is the one that asks for the focus: `open -a QQ`, plus a bounded activation request for key status. Both are named in the `open_session` step detail (`window was absent` / `window was minimized`).
- **The frontmost app is handed back on every exit path**, including a failed `open_session` (the restore is in a `finally`), in two tiers: `activateWithOptions_`, then `open -a <bundle>`. Both are requests macOS can refuse while another app owns the focus, so a refusal leaves the frontmost app where it is — the guarantee is "we try and never move it further", not "it always comes back".
- **A system-tap keystroke (`CGEventPost(kCGSessionEventTap)`) may only be posted after re-checking that QQ is frontmost**, because such a keystroke lands in whatever app owns the focus. Every other key event is pid-addressed, so nothing can be typed into the user's editor or terminal. When QQ cannot be focused, `write_message` fails with a message saying so, and deliberately does not keep trying.
- **The mouse is never moved.** No global mouse events at all: `CGEventPostToPid` is ignored by Chromium for clicks, and a global click would drag the real cursor.
- **The keyboard is never used for text by the user's IME.** Text arrives as a paste, so keyboard layout and IME state do not matter.
- **The clipboard is borrowed and returned.** If the restore fails, the message text stays on the clipboard.
- **Nothing can leak into another app.** Every Return and Cmd+V is addressed to QQ's pid, so a mid-send focus change cannot type into the user's editor.

## Failure modes

| symptom                                        | cause                                                                                                                           | what to do                                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no chat opened` after the press               | QQ's dropdown did not accept the Return (rare; usually a stale search)                                                          | retried once automatically; if it still fails, run `open` again by hand                                                                                                                                   |
| pid-addressed keys stop arriving               | QQ was restarted and its key window state was lost                                                                              | bring QQ to the front once (`open -a QQ`); the AX helpers exist for this, see `activate_qq`                                                                                                               |
| `no search result`                             | name misspelled, or the conversation has no local history (QQ search needs one)                                                 | check the name; `qqctl header` shows what is open                                                                                                                                                         |
| `input box not found`                          | no conversation is open                                                                                                         | `qqctl open "<name>"` first                                                                                                                                                                               |
| `QQ's window is <state>` (absent or minimized) | Chromium exposes no accessibility tree without a window on screen; QQ keeps running with no window after its last one is closed | repaired automatically. Closed windows are fully automatic (verified); for a minimized window the write can still need a real activation, so if the step list fails at `write`, click QQ once and re-send |
| `verify: false`                                | the message never left the box                                                                                                  | re-send; report the failure rather than claiming success                                                                                                                                                  |
| `QQ could not be focused automatically`        | the pid paste did not land and macOS refused to activate QQ (the user is typing elsewhere)                                      | click QQ once and retry. The driver stops instead of posting a global keystroke                                                                                                                           |
| `message box already has text`                 | the user has a draft in that conversation                                                                                       | never overwrite it; ask, or send to another conversation                                                                                                                                                  |
| `QQ is not running`                            | QQ was quit                                                                                                                     | start QQ and log in; qqctl does not launch it                                                                                                                                                             |
| everything stops working after a QQ update     | the AX tree changed (new element roles/labels)                                                                                  | re-dump: `AXManualAccessibility`, then walk the window collecting role/title/description/value; keep coordinates out of the logic and match on roles and labels                                           |

Why not in-process: the kernel API is not reachable from JS on this build, and
replacing QQ's entry stops its UI from starting. The whole experiment, its
rollback, and what it proved is in [injection-attempt.md](injection-attempt.md).

Accessibility permission: the terminal app running the command needs _Accessibility_ (System Settings → Privacy & Security → Accessibility). System Events working from that terminal is the quick check (`osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`). _Automation_ permission is needed for the `osascript ... activate` fallback.

## Debugging

```sh
# what does QQ expose right now?
uv run --quiet --project scripts/qq python - <<'PY'
import sys; sys.path.insert(0, 'scripts/qq')
from qqax import *
app = app_for(int(__import__('subprocess').run(['pgrep','-x','QQ'],capture_output=True,text=True).stdout))
setv(app, "AXManualAccessibility", True)
for el, d in walk(win(app), 12, 800):
    print('  '*d, describe(el))
PY
```

Notes for whoever changes this code:

- Never hardcode screen coordinates. The window can be moved, resized, or parked at negative x on another display; everything above is found by role, label, or window-relative geometry.
- A modifier chord must press and release the real modifier key (`pid_chord`). Setting only the `CGEventFlags` bit leaves Command stuck, and the next Return arrives as Cmd+Return — which QQ treats as a newline, not send. This cost an afternoon once.
- `find_in()` returns `(element, depth)` tuples; `find_role()` returns bare elements. Mixing them up yields a silently empty walk, not an error.
- QQ does not expose a group's name anywhere readable, so "did the right conversation open" cannot be answered for groups. The flow trusts the row it activated and the message-list verification; that is the reason `open` prints the row it pressed.
- The AX tree is lazy: nodes such as the input toolbar only appear after the region has been hovered or focused. Do not conclude "the element does not exist" from one dump.
