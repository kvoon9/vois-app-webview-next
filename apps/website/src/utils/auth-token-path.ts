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

/**
 * Where the page posts a token it read over the bridge, so the dev server can
 * persist it for the next launch. See `writeTokenToEnv` for why native needs it.
 *
 * This must not extend `ACCESS_TOKEN_PATH`: connect's path middleware matches by
 * prefix, so a longer path under the read endpoint is swallowed by it first.
 */
export const SAVE_ACCESS_TOKEN_PATH = '/__auth/save-token.json'
