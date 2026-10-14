# In-process injection: attempt, result, decision

The goal was a delivery path that does not depend on QQ owning the focus. The
answer, for QQ 6.9.95-48798 on macOS: **not reachable this way, do not retry
without new information**. The hook code was removed again before the skill was
committed (it had no delivery use, and it tripwired this repo's lint rules); the
findings below are the record.

## What was built

The hook installer repointed one key — `main` in QQ's `package.json` — at
`qqctl-hook.js`, a file copied into each app dir (the app is sandboxed, so it can
only read its own bundle and its container; `~/.qqctl` and `/tmp` are invisible
to it). Every patched file keeps a `.qqctl-backup` sibling, `uninstall` restores
byte for byte, and both the base bundle and every hot-update version dir are
handled.

The hook boots QQ's original entry unchanged and serves a localhost-only API:

```
GET  /ping                 liveness
GET  /targets              renderer webContents
POST /cdp  {id, code}      Runtime.evaluate in a renderer (Electron's own debugger API)
POST /eval {code}          evaluate JS in the main process
```

## What was learned

1. **Main-process code execution works.** The hook loaded every time, served
   `/ping` and `/eval`, and could `require()` QQ's own `major.node`/`wrapper.node`.
   This part is proven and useful for inspection.
2. **The JS classes are not the app's API.** `require('wrapper.node')` exposes
   `NodeIQQNTWrapperSession` (80 prototype methods) and friends, but wrapping
   every one of those methods — plus `ipcMain.on/handle/emit` — never fired once
   during startup or login. QQ's launcher runs protected bytecode and talks to
   the kernel over its **own native IPC** (`ipc.node`, `libparent-ipc-core.dylib`,
   `libGuildIpcBroadcast.dylib`); `ipcMain._invokeHandlers` stays empty. There is
   no JS-level `sendMsg` to reach from the main process on this build.
3. **Replacing `main` stops the UI from being created.** With the hook installed,
   QQ's process starts, preloads its natives, logs its normal bootstrap lines —
   and never creates a window (`CGWindowList` shows no main window, no renderers,
   `BrowserWindow.getAllWindows()` is 0). This reproduces with a hook whose only
   statement is `require(<original entry>)`, and also when the original entry is
   loaded with `Module._load(entry, null, true)` so it becomes the main module.
   No error is printed. Two wrapped-prototype revisions also broke it, but that
   was a second, separate fault. Conclusion: on this build the launcher expects
   to be Electron's own main script in a way a replacement entry cannot fake.
4. The sandbox redirects `HOME` to `~/Library/Containers/com.tencent.qq/Data`,
   so inside the app "the container" is `~/Library/Application Support/QQ`.
   Logs must go there; `~/.qqctl` and `/tmp` are not writable for the app.

## Rollback (the reason this was safe to try)

```sh
# what the installer did, for the record
#   cp hook.js into each <app>/Contents/Resources/app/qqctl-hook.js
#   write qqctl-hook-config.json next to it (sandbox: the app cannot read ~/.qqctl)
#   repoint "main" in that app's package.json, keeping a .qqctl-backup sibling
# restore
cp <app>/package.json.qqctl-backup <app>/package.json   # for base and the version dir
rm -f <app>/qqctl-hook.js <app>/qqctl-hook-config.json
pkill -x QQ && open -a /Applications/QQ.app
```

Verified after the experiment: `main` back to
`./application.asar/app_launcher/index.js`, no `qqctl-*` or `.qqctl-backup` files
left in any app dir, main window back.

## Decision

The QQ notification keeps using the Accessibility driver (`scripts/qq/qqctl`),
which needs **no modification to QQ at all**. The hook stays in the tree as a
diagnostic tool for future reverse engineering, clearly marked as unusable for
message sending on this build.

Account-safety note, for the record: nothing in either approach touches the
protocol, the network stack, or device identity. The injection route was the
riskier of the two (a modified client, plus an unfamiliar local API), and it is
not used. The AX route is indistinguishable from a person driving the UI.

## If someone picks this up later

- Do not start by patching `main` again; start by finding whether QQ 7.x still
  expects to be the main script. Try a _different_ injection point (a preload
  script of the chat window, if the build exposes one) before touching the entry.
- The `/cdp` endpoint was the promising half: Electron's `webContents.debugger`
  reaches the QQ front-end the UI itself uses, without any command-line switch. It
  is untested because no window was ever created with the hook installed.
- Keep the `.qqctl-backup` discipline: every experiment must end with the
  package.json files restored and a window check. The installer from this attempt
  is gone, so that restore is a manual `git`-less copy of the backup files.
