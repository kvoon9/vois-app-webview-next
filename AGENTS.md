# Common Pitfalls & Best Practices

- Always follow `rizumu`, `antfu`, `vue/vueuse best practice` coding styles
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

Headless tests with real `access-token`. Token is refreshed each session — user opens the preview URL once before testing.

1. `cd apps/website && vp dev --host --port 3021` (hot reload in a second Herdr pane)
2. User opens `http://192.168.1.50:5173/<route>` in Native App WebView → token written to `.env.local`
3. `agent-browser --session webview-debug open 'http://localhost:3021/<route>'` and test

Never print auth parameters.

### Flow B: Real WebView (event capture)

User operates the phone; agent reads `.tmp/vois-webview-debug/events.jsonl`.

1. User opens `http://192.168.1.50:5173/<route>` in Native App WebView, performs actions
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

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
