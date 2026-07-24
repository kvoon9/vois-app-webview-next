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

## Authenticated WebView testing

Use this flow when browser tests need the Native App's real `access-token` and URL parameters. Do not create a debug login or probe production APIs for authentication.

1. Build the latest website when production output changed:
   ```sh
   vp run --filter website build
   ```
2. In Herdr, start preview with auth capture enabled:
   ```sh
   cd apps/website
   vp preview --host --port 5173 --debug
   ```
3. Give the user the LAN preview URL and route, then wait for them to open it in the Native App WebView. The preview server captures the incoming path and query parameters automatically.
4. In another Herdr pane, start the dev server:
   ```sh
   cd apps/website
   vp dev --host --port 3021
   ```
5. Open the one-time relay with a fresh agent-browser session. Suppress `open` output because the redirect URL contains the token:
   ```sh
   agent-browser --session webview-debug open 'http://localhost:3021/debug' >/dev/null
   agent-browser --session webview-debug wait --load networkidle
   ```
6. Continue testing in the same browser session. Navigate directly to other localhost routes; the token is already stored by the app.
7. Inspect captured WebView network metadata in `/tmp/vois-webview-debug/events.jsonl`; query values are redacted.
8. Run `vp check`, `vp test`, and the relevant build after making changes. Close agent-browser and stop both Herdr servers when finished.

The relay expires after 30 minutes and can be opened only once. A `404` from `/debug` means it was missing, expired, or already consumed; ask the user to reopen the preview URL. Never print, log, or paste captured auth parameters.

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
