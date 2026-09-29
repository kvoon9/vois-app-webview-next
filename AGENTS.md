# Common Pitfalls & Best Practices

- Always follow `rizumu`, `antfu`, `vue/vueuse best practice` coding style skills
- Use `@pinia/colada` to manage data fetching. Search its docs with `ctx7 library @pinia/colada`, then `ctx7 docs <libraryId> "<question>"`.
- Always use `<script setup>` in SFCs. Never hand-write a bare `{ setup() {} }` component object — it lacks component scope, so inject, watch, and onScopeDispose won't work correctly.
- Always use Vue's `shallowRef` over `ref` by default. Using ref requires a solid justification and a code comment explaining why deep reactivity is needed.
- Prefer using `defuddle` to fetch web content, `ast-grep` to search local codebase
- Prefer using existed VueUse functions instead of create a custom composition API
- Use space, flex instead of gap, grid for styling, since they have compatibility issues: `apps/website/uno.config.ts` blocks them, and `vp test` fails on any used in a class attribute
- Do not put a `placeholder:` utility on the `input-field` shortcut. UnoCSS expands shortcuts inside its preflight, so it collides with `.input-field::placeholder` and emits `::placeholder::placeholder`, which breaks the build in the lightningcss minifier.
- Use `agent-browser` to test interactive UI behavior (clicks, form inputs, visual state) in addition to `vp check` and `vp test`
- Leaving a page after a save or submit ("done" buttons included) must go through `usePageBack().goBack()`, the same path as the header back button. Never call `router.back()` or hand-roll a fallback directly — that is what drops the native `close-page` handshake.
- Commit messages and PR titles must follow Conventional Commits, e.g. fix(runtime): align Ink parity behavior.
- Use herdr to start a dev server

## New Worktree Setup

Machine-specific values live in `~/.vois/`, outside the repo, so a fresh worktree copies no secrets:

```sh
cp apps/website/.env.example ~/.vois/.env   # once per machine, then fill in the values
cd <worktree> && vp install
```

`~/.vois/.env` holds `VITE_APP_ID` / `VITE_APP_KEY` (build) and the AMap keys the device-location page needs. `vite.config.ts` points `envDir` there, so every worktree shares one copy; CI has no such directory and injects the same names as `process.env`, which wins over the file.

## WebView Testing

Every flow runs against a `--debug` server: it captures auth, injects debug into all SPA routes, records events to `.tmp/vois-webview-debug/events.jsonl`, and clears them on restart. `isWebviewDebug()` (`~/composables/useWebviewDebug`) detects that server, so gate any debug-only UI behind it.

```sh
cd apps/website && vp run --filter website build && vp preview --host --port 5173 --debug
```

The app has **one** token entry point: `bridge.getAccessToken()` from `~/utils/bridge`. It first requests native `get-page-params` with `{ page: currentRoutePath, params: ['access-token'] }`. If no usable token arrives, dev (`import.meta.env.DEV`) and debug preview (`isWebviewDebug()`) may call `getDebugAccessToken()` from `@vois/webview-bridge/debug` to log in with the existing fixed account. Production never enables that fallback. Concurrent callers share the whole native-read/login attempt; each later call tries native first again. Native readiness/response is bounded to 10 seconds; fallback login has its own 15-second network timeout. No new native protocol is required. Both HTTP requests and uploads use this entry point.

Website `usePageParams()` preserves all scalar fields, including token fields, and normal route-query precedence. It does not write authentication state or trigger login. The debug bridge's page params also never trigger login: only `getDebugAccessToken()` does. Debug login success is reused in memory, while a failure is forgotten for retry. `main.ts` enables the debug bridge before warming the channel. HTTP authentication does not read route-query tokens or browser storage. Token fields in bridge response logs are redacted.

The fixed account is for dev and debug preview only. Preview runs the production artifact, so the runtime script marker injected by the debug server enables preview fallback; production hosting without that marker must never invoke fixed-account login.

1. `cd apps/website && vp dev --host --port 3021` (hot reload in a second Herdr pane)
2. `agent-browser --session webview-debug open 'http://localhost:3021/#/<route>'` (hash routing) and test

Never print auth parameters.

### Reading captured events

The server records what the page did. Read it with `vp run website#debug:logs`, or `curl http://127.0.0.1:5173/__debug/status` for the pipeline state. `🟢 WebView debug connected` confirms the pipeline; if it is missing, reload with `?debug-reload=1`.

`debug:logs` prints event URLs and bodies verbatim, auth parameters included. Treat its output as secret.

| Event       | Trigger                              |
| ----------- | ------------------------------------ |
| `lifecycle` | load, SPA nav, foreground/background |
| `network`   | any `fetch()` (full URL + body)      |
| `console`   | `log`/`warn`/`error`                 |
| `error`     | unhandled rejection, `onerror`       |

### Production preview

`vp run preview:production` builds, then serves `dist/` under the same subpath a real
deployment uses. `--base` is what puts it there, and `--debug` is what lets the page
authenticate without a native bridge.

```sh
vp run preview:production   # http://localhost:8080/vois-app-webview-next/
```

Opening it is the point: the artifact only has relative asset paths (`base: './'`),
so a regression that breaks subpath deployment shows up as a blank page here rather
than in production.

### Switching between worktree previews

Each worktree serves a different port. In a `--debug` server, tap the header title to enter a port; it rewrites only the port and keeps host, path, query, and hash, so the launch params survive the switch.

## Release

Cut releases on `main` with the `bumpp` CLI through the repo script. The tag push needs the **kvoon9** GitHub account: the default active account is `kvoon3`, which has no access to this repo, so the push fails with 403.

```sh
gh auth switch --user kvoon9   # the account that can push to kvoon9/vois-app-webview-next
vp run release patch --yes     # bumpp --recursive: bumps all package.json files, commits chore: release vX.Y.Z, tags, pushes
gh auth switch --user kvoon3   # back to the usual account
```

`--yes` skips the interactive confirm; use `minor`/`major` instead of `patch` as needed. The pushed `vX.Y.Z` tag triggers `.github/workflows/release.yml`, which builds the site and publishes `vois-app-webview-vX.Y.Z.zip`:

```sh
gh run list -L 1 -R kvoon9/vois-app-webview-next
gh release view vX.Y.Z -R kvoon9/vois-app-webview-next
```

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
