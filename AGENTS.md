# Common Pitfalls & Best Practices

- Always follow `rizumu`, `antfu`, `vue/vueuse best practice` coding style skills
- Use `@pinia/colada` to manage data fetching (use ctx7 cli to search its docs when needed)
- Always use defineComponent() to define components. Never use bare { setup() {} } objects — they lack component scope, so inject, watch, and onScopeDispose won't work correctly.
- Always use Vue's `shallowRef` over `ref` by default. Using ref requires a solid justification and a code comment explaining why deep reactivity is needed.
- Perfer using `defuddle` to fetch web content, `ast-grep` to search local codebase
- Perfer using existed vueuse functions instead of create a custom composition api
- Use space, flex instead of gap, grid for styling, since they have compatibility issues
- Use `agent-browser` to test interactive UI behavior (clicks, form inputs, visual state) in addition to `vp check` and `vp test`
- Commit messages and PR titles must follow Conventional Commits, e.g. fix(runtime): align Ink parity behavior.
- Using herdr to start a dev server

## WebView Testing

Both flows start from a `--debug` preview server. It captures auth, injects debug into all SPA routes, and auto-clears events on restart.

```sh
cd apps/website && vp run --filter website build && vp preview --host --port 5173 --debug
```

### Flow A: Automated (agent-browser)

Headless tests with real `access-token`. The token persists in `.env.local` — no need to reopen the WebView unless it expires (API returns `授权失效` / errcode 31).

1. `cd apps/website && vp dev --host --port 3021` (hot reload in a second Herdr pane)
2. Only when the token is missing or expired: user opens `http://<Mac IP>:5173/<route>` (the Network URL printed by `vp preview`) in Native App WebView → token written to `.env.local`
3. `agent-browser --session webview-debug open 'http://localhost:3021/#/<route>'` (hash routing) and test

Never print auth parameters.

### Flow B: Real WebView (event capture)

User operates the phone; agent reads `.tmp/vois-webview-debug/events.jsonl`.

1. User opens `http://<Mac IP>:5173/<route>` (the Network URL printed by `vp preview`) in Native App WebView, performs actions
2. Read: `node apps/website/scripts/parse-events.js` or `curl http://127.0.0.1:5173/__debug/status`
3. `🟢 WebView debug connected` confirms pipeline; missing → `?debug-reload=1`

| Event       | Trigger                              |
| ----------- | ------------------------------------ |
| `lifecycle` | load, SPA nav, foreground/background |
| `network`   | any `fetch()` (full URL + body)      |
| `console`   | `log`/`warn`/`error`                 |
| `error`     | unhandled rejection, `onerror`       |

### Flow C: Debug & fix (B → A)

1. User reproduces bug in real WebView → triggers events captured by [Flow B](#flow-b-real-webview-event-capture)
2. Agent reads events to diagnose root cause
3. Agent reproduces with agent-browser → [Flow A](#flow-a-automated-agent-browser)
4. Fix, verify, repeat

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
