/**
 * Endpoint the dev/preview server exposes the worktree-shared token on.
 *
 * Browser-safe on purpose: the server plugin and the app both import it, and the
 * plugin module pulls in `node:fs`, which must not reach the app bundle.
 *
 * The `.json` suffix is load-bearing. The WebView debug plugin runs
 * `enforce: "pre"`, and its preview fallback answers index.html for every GET
 * whose path lacks a dot, so a dotless path is served HTML instead of the token.
 */
export const ACCESS_TOKEN_PATH = '/__auth/token.json'
