/**
 * Retracts the phone keyboard from a field that filters as the user types.
 *
 * The WebView turns the keyboard's 搜索 key into a plain Enter keydown. A live
 * filter has nothing to submit, so nothing hides the keyboard and it keeps
 * covering the results the field just produced. Blurring the field is what tells
 * the WebView to hide the IME.
 *
 * Bind it to `keydown.enter` so it fires on the action key only.
 */
export function dismissSoftKeyboard(event: KeyboardEvent): void {
  // Enter that only ends an IME composition commits the typed text; the field
  // must keep focus so the user can continue, or press the action key again.
  if (event.isComposing) return
  if (event.target instanceof HTMLElement) event.target.blur()
}
