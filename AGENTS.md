# Common Pitfalls & Best Practices

- Always follow `rizumu`, `antfu`, `vue/vueuse best practice` coding style skills
- Use `@pinia/colada` to manage data fetching. Search its docs with `ctx7 library @pinia/colada`, then `ctx7 docs <libraryId> "<question>"`.
- Always use `<script setup>` in SFCs. Never hand-write a bare `{ setup() {} }` component object — it lacks component scope, so inject, watch, and onScopeDispose won't work correctly.
- Always use Vue's `shallowRef` over `ref` by default. Using ref requires a solid justification and a code comment explaining why deep reactivity is needed.
- Prefer using `defuddle` to fetch web content, `ast-grep` to search local codebase
- Prefer using existed VueUse functions instead of create a custom composition API
- Use space, flex instead of gap, grid for styling, since they have compatibility issues: `apps/website/uno.config.ts` blocks them, and `vp test` fails on any used in a class attribute
- Do not put a `placeholder:` utility on the `input-field` shortcut. UnoCSS expands shortcuts inside its preflight, so it collides with `.input-field::placeholder` and emits `::placeholder::placeholder`, which breaks the build in the lightningcss minifier.
- Use ego lite's `ego-browser` to test interactive UI behavior (clicks, form inputs, visual state) in addition to `vp check` and `vp test`. Read `.agents/skills/ego-browser/SKILL.md` first. Use the user's shared browser login state; do not use `agent-browser` or launch a separate browser for this project.
- Leaving a page after a save or submit ("done" buttons included) must go through `usePageBack().goBack()`, the same path as the header back button. Never call `router.back()` or hand-roll a fallback directly — that is what drops the native `close-page` handshake.
- Commit messages and PR titles must follow Conventional Commits, e.g. fix(runtime): align Ink parity behavior.
- Use herdr to start a dev server
- Use the DevServer on port 3021 for daily development, debugging, and interactive UI testing. Preview is only for validating production builds or deployment paths; do not start it as the primary development server.

## New Worktree Setup

Machine-specific values live in `~/.vois/`, outside the repo, so a fresh worktree copies no secrets:

```sh
cp apps/website/.env.example ~/.vois/.env   # once per machine, then fill in the values
cd <worktree> && vp install
```

`~/.vois/.env` holds `VITE_APP_ID` / `VITE_APP_KEY` (build) and the AMap keys the device-location page needs. `vite.config.ts` points `envDir` there, so every worktree shares one copy; CI has no such directory and injects the same names as `process.env`, which wins over the file.

## WebView Testing

Run daily WebView flows against the DevServer, with hot reload, in a second Herdr pane. No build or Preview server is needed:

```sh
cd apps/website && vp dev --host --port 3021
```

The debug plugin captures auth, injects debug into all SPA routes, records events to `.tmp/vois-webview-debug/events.jsonl`, and clears them on restart. `isWebviewDebug()` (`~/composables/useWebviewDebug`) detects that server, so gate any debug-only UI behind it. Production Preview needs `--debug` to enable this pipeline.

After upgrading dependencies, restart the DevServer. If stale dependency caches cause rendering or injection errors, restart with `vp dev --host --port 3021 --force` and reload the browser to rebuild the optimized dependencies.

The app has **one** token entry point: `bridge.getAccessToken()` from `~/utils/bridge`. An explicitly selected H5 account takes priority. Otherwise it requests native `get-page-params` with `{ page: currentRoutePath, params: ['access-token'] }`. If no usable token arrives, dev (`import.meta.env.DEV`) and debug preview (`isWebviewDebug()`) may call `getDebugAccessToken()` from `@vois/webview-bridge/debug` to log in with the existing fixed account. Production never enables that fallback. Concurrent callers share the whole native-read/login attempt; without an explicit selection, each later call tries native first again. Native readiness/response is bounded to 10 seconds; fallback login has its own 15-second network timeout. No new native protocol is required. Both HTTP requests and uploads use this entry point.

`useAccountRegistry` and `useAccounts` manage the H5 account list for both Bridge and password sign-ins. `useAccountProfile` reads `/v2/user/get-my-user-info`, merges identities by user ID, and caches display metadata (nickname, account number, avatar URL) separately from authentication. Profiles persist in local storage; account tokens stay in session storage for the current tab. Existing saved password credentials remain compatible. Switching accounts clears query caches, and late profile responses cannot overwrite a newer session. A cached Bridge account can be selected again while its session is available; H5 selection does not switch the native App's own account. Password sign-in and the Add account entry remain limited to dev/debug environments.

Page-parameter reads have the same 10-second budget as native token reads. Consumers on the same page share existing fields; navigation and explicit retries retire old reads and start immediately, ignoring late answers. `useAccountId` treats a valid device navigation context or selected H5 session as ready independently of native page-parameter status; only accounts requiring native `login-id` wait for that read. DevServer's debug `login-id` response can wait for the gateway session, so a three-second page-parameter budget causes false timeouts during a cold login.

Website `usePageParams()` reads native's fixed web default fields from the bridge `get-page-params` (`theme`, `lang`, `login-id`, `device-type`, plus `pkg-name` / `wxpay-appid` / `pay-method`); page-specific launch params (`uuid`, `hardware-id`, `name`, target ids) are not native-returnable and stay in the route query, while `route.params` still carries path resource IDs. The one H5 value native cannot know — the device-flow account — rides `useNavigationContext` in `history.state`: a push carries it explicitly, back/forward restore each entry's own context, and a refresh relies on the browser restoring that entry's state (a host that recreates history falls back to the owner's bridge `login-id` instead). It does not write authentication state or trigger login. The debug bridge's page params also never trigger login: only `getDebugAccessToken()` does. Under the debug server an app-layer adapter merges non-auth URL params from that same default set into `get-page-params` answers (hash query wins over the outer search; token fields are never injected). HTTP authentication does not read route-query tokens; selected H5 sessions are read only through the shared account session and `bridge.getAccessToken()`. Token fields in bridge response logs are redacted.

The fixed account is for dev and debug preview only. Preview runs the production artifact, so the runtime script marker injected by the debug server enables preview fallback; production hosting without that marker must never invoke fixed-account login.

1. `cd apps/website && vp dev --host --port 3021` (hot reload in a second Herdr pane)
2. Use `ego-browser` to open `http://localhost:3021/#/<route>` (hash routing) and test. Create one TaskSpace for the task and reuse its numeric ID in later rounds:

```sh
ego-browser nodejs <<'EOF'
const task = await taskSpace("Vois WebView debugging");
const page = task.page("p1");
await page.goto("http://localhost:3021/#/settings/friends");
console.log({ taskSpaceId: task.spaceId, page: page.label });
console.log(await page.snapshot());
EOF
```

The skill is installed at `.agents/skills/ego-browser` from `citrolabs/ego-lite` (`skills/ego-browser`). The CLI comes from the ego lite app. If `ego-browser` is unavailable, follow the skill's `references/install.md`; the user must complete first-run onboarding. Reuse the same TaskSpace and the shared profile without clearing browser storage or changing profiles. Website authentication is also tab-scoped, so the user and agent must use the same page when they need the same selected H5 account; a shared browser profile alone does not share `sessionStorage`. Follow the skill's handoff and completion workflow.

Debug inputs: native's default fields (`login-id`, `theme`, `lang`, `device-type`, ...) come from the URL through the app-layer adapter (hash query wins over the outer search; token fields are ignored), while page-specific params (`uuid`, `hardware-id`, ...) are read directly from the route query. Examples: `#/settings/friends?login-id=456`, `#/devices?hardware-id=441`.

`#/login` signs the debug session in as an external account (帐号/手机号 + 密码): the dev/debug server logs in on the TCP gateway, after which the token endpoint and the bridge's `login-id` answer serve that account for the page's life (a URL `login-id` still overrides).

Never print auth parameters.

### MCP debugging

`packages/mcp` is an MCP stdio server (wired as `vois-debug` in `.pi/mcp.json`) that gives an agent the debug pipeline without a browser: `status` finds the debug server, `events` reads the capture (tokens redacted), `login` re-signs the fixed account or switches accounts, `token` verifies the mint, and `api` performs signed `/v2` calls as the signed-in account. It runs from source on Node >= 22.18 (`node packages/mcp/src/cli.ts`), probes ports `3021` / `5173` / `8080`, and never returns the token itself. See `packages/mcp/README.md`.

### Reading captured events

The server records what the page did. Read it with `vp run website#debug:logs`, or `curl http://127.0.0.1:3021/__debug/status` for the pipeline state. `🟢 WebView debug connected` confirms the pipeline; if it is missing, reload with `?debug-reload=1`.

`debug:logs` prints event URLs and bodies verbatim, auth parameters included. Treat its output as secret.

| Event       | Trigger                              |
| ----------- | ------------------------------------ |
| `lifecycle` | load, SPA nav, foreground/background |
| `network`   | any `fetch()` (full URL + body)      |
| `console`   | `log`/`warn`/`error`                 |
| `error`     | unhandled rejection, `onerror`       |

### Production preview

Use this only when validating the production artifact or deployment subpath, or when explicitly requested. Daily development and UI testing use the DevServer on port 3021.

`vp run preview:production` builds, then serves `dist/` under the same subpath a real
deployment uses. `--base` is what puts it there, and `--debug` is what lets the page
authenticate without a native bridge.

```sh
vp run preview:production   # http://localhost:8080/vois-app-webview-next/
```

Opening it is the point: the artifact only has relative asset paths (`base: './'`),
so a regression that breaks subpath deployment shows up as a blank page here rather
than in production.

### Switching between worktree servers

Each worktree's DevServer uses a different port (3021 for the main workspace). With the debug pipeline enabled, tap the header title to enter a port; it rewrites only the port and keeps host, path, query, and hash, so the launch params survive the switch.

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
