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

Machines running the local `kvoon.worktree-hooks` herdr plugin execute the `herdr-worktree.yaml` hooks automatically on worktree creation (`vp install` there covers the dependency step); without the plugin, follow the manual steps above.

## Feature lanes and acceptance

Features ship as lanes: one lane = one worktree + one branch (`worktree/<lane>`) + one PR against main, built by delegated subagents. Create the worktree with `herdr worktree create --branch worktree/<lane> --base main` (or `herdr_worktree_jump`), never bare `git worktree add`. Keep lanes file-disjoint; anything touching the same file serializes.

- **Agent roles**: code agents run on the `deepseek-flash` template; judgment, review, and anything visual run on the `judge` template (glm-5.3-flash with image input). Always pass `agent_type` explicitly; a generic subagent inherits the parent model.
- **Briefs are self-contained** (subagents see no parent conversation): file pointers, constraints, lanes to stay out of, and acceptance criteria written as measurable checks. Point subagents at `.pi/skills/verify-vois-webview/features/` when the touched screen has a behavior map.
- **Gates, exit codes only**: never pipe gate commands into `tail` (the pipe masks the failure exit), and never chain them with `;` (the chain continues past a failure). Run `vp run ready` (check, test, build) and require exit 0, on the committed tree. CI repeats `vp check && vp test` on every PR; build stays a local gate.
- **Browser evidence** comes from the verification skill's pipeline: the lane worktree's own DevServer port, `scripts/doctor.mjs`, ego-browser drives, and `.tmp/vois-webview-debug/events.jsonl` captures. Report measurements and captured events, not adjectives.
- **Vision acceptance for UI changes**: before pushing, screenshot the changed views at the primary phone size (375×812) and, when the change touches layout geometry, sweep the small-phone edge (320×568) too; then have a `judge` agent review the PNGs against the intended design. Fix and re-shoot until confirmed.
- **Push once per lane**: commit freely in the worktree, but push only when the lane is review-ready, and afterwards only for review fixups. Every push starts a CI run, yet only a lane's final commit is reviewed. `vp run ready` locally is the feedback loop; pushing is not a checkpoint.
- **PRs**: one per lane, title under Conventional Commits, body carries evidence (measurements, capture excerpts, screenshot paths, known trade-offs). The push and `gh pr create` both need the kvoon9 account (`gh auth switch --user kvoon9`, switch back afterwards — see Release). Humans review and merge.
- **Landing**: from the main checkout, commit everything in the worktree first (`git add -A`), then `git cherry-pick`, never `git merge`. Conflicts: keep both sides (union), then `git -c core.editor=true cherry-pick --continue`. After landing, verify (`vp install` if deps changed, `vp run ready` exit 0), then `herdr worktree remove --workspace <ID>` and `git branch -D <branch>`.

## WebView Testing

The app is developed and verified against the DevServer on port 3021. The debug plugin captures auth, injects debug into all SPA routes, records events to `.tmp/vois-webview-debug/events.jsonl`, and clears them on restart. `isWebviewDebug()` (`~/composables/useWebviewDebug`) detects that server, so gate any debug-only UI behind it. Production Preview needs `--debug` to enable this pipeline.

The app has **one** token entry point: `bridge.getAccessToken()` from `~/utils/bridge`. An explicitly selected H5 account takes priority. Otherwise it requests native `get-page-params` with `{ page: currentRoutePath, params: ['access-token'] }`. If no usable token arrives, dev (`import.meta.env.DEV`) and debug preview (`isWebviewDebug()`) may call `getDebugAccessToken()` from `@vois/webview-bridge/debug` to log in with the existing fixed account. Production never enables that fallback. Concurrent callers share the whole native-read/login attempt; without an explicit selection, each later call tries native first again. Native readiness/response is bounded to 10 seconds; fallback login has its own 15-second network timeout. No new native protocol is required. Both HTTP requests and uploads use this entry point.

`useAccountRegistry` and `useAccounts` manage the H5 account list for both Bridge and password sign-ins. `useAccountProfile` reads `/v2/user/get-my-user-info`, merges identities by user ID, and caches display metadata (nickname, account number, avatar URL) separately from authentication. Profiles persist in local storage; account tokens stay in session storage for the current tab. Existing saved password credentials remain compatible. Switching accounts clears query caches, and late profile responses cannot overwrite a newer session. A cached Bridge account can be selected again while its session is available; H5 selection does not switch the native App's own account. Password sign-in and the Add account entry remain limited to dev/debug environments.

Page-parameter reads have the same 10-second budget as native token reads. Consumers on the same page share existing fields; navigation and explicit retries retire old reads and start immediately, ignoring late answers. `useAccountId` treats a valid device navigation context or selected H5 session as ready independently of native page-parameter status; only accounts requiring native `login-id` wait for that read. DevServer's debug `login-id` response can wait for the gateway session, so a three-second page-parameter budget causes false timeouts during a cold login.

Website `usePageParams()` reads native's fixed web default fields from the bridge `get-page-params` (`theme`, `lang`, `login-id`, `device-type`, plus `pkg-name` / `wxpay-appid` / `pay-method`); page-specific launch params (`uuid`, `hardware-id`, `name`, target ids) are not native-returnable and stay in the route query, while `route.params` still carries path resource IDs. The one H5 value native cannot know — the device-flow account — rides `useNavigationContext` in `history.state`: a push carries it explicitly, back/forward restore each entry's own context, and a refresh relies on the browser restoring that entry's state (a host that recreates history falls back to the owner's bridge `login-id` instead). It does not write authentication state or trigger login. The debug bridge's page params also never trigger login: only `getDebugAccessToken()` does. Under the debug server an app-layer adapter merges non-auth URL params from that same default set into `get-page-params` answers (hash query wins over the outer search; token fields are never injected). HTTP authentication does not read route-query tokens; selected H5 sessions are read only through the shared account session and `bridge.getAccessToken()`. Token fields in bridge response logs are redacted.

The fixed account is for dev and debug preview only. Preview runs the production artifact, so the runtime script marker injected by the debug server enables preview fallback; production hosting without that marker must never invoke fixed-account login.

`#/login` signs the debug session in as an external account (帐号/手机号 + 密码): the dev/debug server logs in on the TCP gateway, after which the token endpoint and the bridge's `login-id` answer serve that account for the page's life (a URL `login-id` still overrides).

### Verification skill

`.pi/skills/verify-vois-webview` owns every procedure for driving and proving this app: launching the DevServer, `scripts/doctor.mjs`, driving with `ego-browser`, reading the debug capture, and the proof standards. Its `features/` directory is the maintained map of user-facing behavior — read it before testing a screen. `/skill:maintain-verification-skill` re-checks that map against source and a live session; `/skill:create-verification-skill` generates one for a project that has none.

The ego-browser skill is installed at `.agents/skills/ego-browser` from `citrolabs/ego-lite`, and its CLI comes from the ego lite app.

### Release skill

`.pi/skills/release` owns shipping a version: `bumpp --recursive`, the tag push that triggers `.github/workflows/release.yml`, waiting for the GitHub Release, and the Chinese QQ notification sent through the local QQ desktop app. Its `references/` fixes the message format (`message-format.md`), the release pipeline (`pipeline.md`) and the QQ driver (`qqctl.md`). The notification body is commit-derived; changelogen was dropped because its markdown and blank lines do not survive a QQ message.

### Switching between worktree servers

Each worktree's DevServer uses a different port (3021 for the main workspace). With the debug pipeline enabled, tap the header title to enter a port; it rewrites only the port and keeps host, path, query, and hash, so the launch params survive the switch.

## Figma Design Access

Design file: https://www.figma.com/design/hLC1vCNnZq9bhVay76gJYJ/VoisChat (page "App design"). Figma access goes through TemPad Dev only — the old `figma-developer-mcp` REST integration is gone.

The TemPad Dev browser extension is installed in **ego browser** (not the user's daily Chrome). The VoisChat tab must be open there with the TemPad panel's **MCP access** enabled and the MCP badge showing **Active**; with several Figma tabs open, the badge marks which file the agent reads. `mcp__tempad_dev__list_design_sessions` confirms the connection (`fileName: "VoisChat"`).

The `tempad-dev` entry in `.pi/mcp.json` runs `scripts/tempad-dev-mcp.mjs`, which self-installs the pinned server into `~/.vois/tools/tempad-mcp` (machine-local, shared across worktrees) on first start — no setup step on a new machine or worktree. The pin lives in that script: MCP 0.11.0 requires extension 0.23.x; upgrade both together by editing only the script's `VERSION`. Do not switch to `npx @tempad-dev/mcp@latest` — `npx` fails inside this repo (`package.json` devEngines forces pnpm) and `@latest` drifts from the paired extension. Use `pnpm dlx` for one-off npm packages.

Reading designs: locate screens by name with `get_structure` (the page has 500 roots; use `depth` and `remainingNodeIds` pagination), then `get_code` with `preferredLang: "vue"`. Over-budget screens return a shell plus direct child ids — fetch those individually instead of re-creating the layout. Asset URLs are temporary loopback secrets; download immediately, never persist them. The `.agents/skills/figma-design-to-code` and `design-in-figma` skills (registered in `skills-lock.json`) route implementation and canvas-authoring work.

Tailwind output adaptation: `get_code` emits Tailwind, but this repo bans `gap-*`/`grid` utilities — convert to `space-*`/flex layouts (see the top of this file). Arbitrary values like `w-[375px]` map 1:1 to UnoCSS.

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
