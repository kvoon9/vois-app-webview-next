---
name: release
description: 'Cut a release for vois-app-webview-next end to end: bump every workspace package with bumpp, push the tag, wait for the GitHub Release workflow to publish the zip, then send the Chinese release notification to QQ. Use when asked to release, ship, publish, bump the version, or notify QQ about a new version.'
---

# Release vois-app-webview-next

One release is four steps in a fixed order. Only the first one touches the repo; the last one talks to the QQ desktop app on this Mac.

```
bumpp --recursive  ->  tag push  ->  Release workflow (GitHub Release + zip)  ->  QQ notification
```

`scripts/release.mjs` runs the whole thing; every step can also be run alone.

```sh
node .pi/skills/release/scripts/release.mjs --type minor          # the whole flow
node .pi/skills/release/scripts/release.mjs --type patch --dry-run # print the plan only
node .pi/skills/release/scripts/release.mjs --skip-bump --skip-watch --notes-file /tmp/notes.txt
```

| flag                                             | meaning                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `--type`                                         | `patch` (default), `minor`, `major`, `premajor`, `preminor`, `prepatch`, `prerelease`, or an explicit version |
| `--dry-run`                                      | print the plan; nothing is bumped, pushed or sent                                                             |
| `--skip-bump` / `--skip-watch` / `--skip-notify` | run one part of the flow                                                                                      |
| `--no-push`                                      | bump and tag locally, do not push (no workflow, no notification)                                              |
| `--to`                                           | QQ conversation name, default `ai 全自动发版本消息测试`（not a personal chat）                                |
| `--notes-file`                                   | send this body instead of the commit draft (see below)                                                        |
| `--allow-dirty`                                  | skip the clean-tree check                                                                                     |
| `--watch-timeout`                                | seconds to wait for the GitHub Release (default 300)                                                          |

## 1. Bump

`bumpp --recursive` bumps the root and every `apps/*` / `packages/*` package, commits `chore: release vX.Y.Z`, tags, and pushes. The tag push is what starts CI, so a release is never local-only unless `--no-push` is passed.

Rules that are not optional:

- Run it from the repo root on `main`, with a clean tree. `--allow-dirty` exists but the release commit would then carry unrelated files.
- Commit messages before the release must follow Conventional Commits; `changelog.mjs` maps `feat`/`fix`/`docs`/`build`/… to the notification's Chinese sections and drops `chore(release)` noise. A vague commit ("update") is silently skipped in the notification.
- Never edit `version` fields by hand: bumpp writes all six packages, and a half-bumped workspace breaks the build.

## 2. Watch the GitHub Release

`.github/workflows/release.yml` runs on `v*` tags: it builds `apps/website` with the `VITE_APP_ID` / `VITE_APP_KEY` secrets, zips `dist` into `vois-app-webview-<tag>.zip`, and publishes the GitHub Release with `changelogithub@14`.

`release.mjs` finds the run by tag (`gh run list --workflow release.yml`), follows it with `gh run watch --exit-status`, then waits for `gh release view <tag>` to report a published release with assets. A failed workflow aborts before the QQ step — no notification for a version that never shipped.

Do this by hand only to re-run the tail of a release:

```sh
gh run list --workflow release.yml --limit 5
gh run watch <database-id> --exit-status
gh release view v0.12.0 --json url,assets,isDraft
```

## 3. The QQ notification

The message is short, Chinese and plain text. The exact shape — title line, summary line, one line per section, no blank lines, no markdown, no emoji, and the fixed closing line `有空可更新一下 @大宝` — is **fixed in [references/message-format.md](references/message-format.md)**. Read it before composing a body. `buildMessage()` appends the closing line itself, so a `--notes-file` body must not repeat it.

The default target is the `ai 全自动发版本消息测试` group (`DEFAULT_SESSION` in `scripts/notify-release.mjs`, shared by `release.mjs`); `--to` overrides it per run. Release notifications do not go to a personal chat.

Two ways to produce the body:

1. **Agent rewrite (preferred).** `node .pi/skills/release/scripts/changelog.mjs --json` prints the commits grouped by section; rewrite each item into concise Chinese following the format reference, write the body to a file, and pass `--notes-file`. The draft keeps raw English commit subjects, which read badly in a Chinese chat.
2. **Commit draft.** Without `--notes-file`, `notify-release.mjs` sends the draft as-is: Chinese section labels with untranslated subjects. Acceptable for an internal notification, visibly worse than the rewrite.

```sh
node .pi/skills/release/scripts/changelog.mjs --json --to v0.12.0      # raw material
node .pi/skills/release/scripts/notify-release.mjs --tag v0.12.0 --dry-run
node .pi/skills/release/scripts/notify-release.mjs --tag v0.12.0 --notes-file /tmp/notes.txt
```

Delivery goes through `scripts/qq/qqctl`, which drives the QQ desktop app through the macOS Accessibility API plus key events addressed to QQ's own process. It does not move the mouse, does not use the keyboard for text, and does not bring QQ to the front while sending — a send runs while the user keeps working in another window. It does repair the window itself, and both hidden states were verified end to end: a **closed** window is reopened, a **minimized** one is brought back and takes the paste too. A minimized window still depends on macOS granting QQ the focus for a moment, so if a delivery fails at `write`, one click on QQ and a re-run is the fix. Every failure mode is in [references/qqctl.md](references/qqctl.md).

Say so when the notification fails instead of retrying silently: the release is already published, and a "sent" claim that never reached QQ is worse than a visible error.

## Repository facts worth not rediscovering

- Release flow before this skill: `pnpm release` = `bumpp --recursive`, then the tag push triggers `.github/workflows/release.yml`.
- The GitHub Release body is generated by `changelogithub@14` in CI. That markdown is **not** reused for QQ: it carries emoji, `<samp>` HTML and `&nbsp;` entities.
- changelogen was tried first and dropped — see [references/message-format.md](references/message-format.md) for the two QQ-specific reasons.
- The QQ desktop app must be running and logged in; `qqctl` cannot start it for you.
- **Do not try in-process injection again without reading [references/injection-attempt.md](references/injection-attempt.md).** It was built, it works for main-process diagnostics, and on this QQ build replacing the app entry stops QQ from creating its UI. The AX driver needs no modification to QQ and is what ships.
