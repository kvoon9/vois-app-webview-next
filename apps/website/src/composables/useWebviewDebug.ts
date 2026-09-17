/** The debug plugin injects this module script into the head of every page it serves. */
const DEBUG_CLIENT_SELECTOR = 'script[src="/__debug/client.js"]'

/**
 * True when the Vite WebView debug plugin is serving this page, in dev and in
 * `--debug` preview. The plugin's own client script does all instrumentation,
 * so this only gates debug-only UI.
 */
export function isWebviewDebug(): boolean {
  return document.querySelector(DEBUG_CLIENT_SELECTOR) !== null
}
