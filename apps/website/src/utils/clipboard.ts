/** The two ways the app can put text on the clipboard, injected so both paths are testable. */
export interface ClipboardAccess {
  writeText: (text: string) => Promise<void>
  copyViaSelection: (text: string) => boolean
}

/**
 * Copies `text`, preferring the async Clipboard API and falling back to a
 * temporary selection. The fallback is the path that matters on a phone: a
 * preview served over plain HTTP on a LAN IP is not a secure context, so
 * `navigator.clipboard` is absent or blocked there.
 *
 * Returns false when both paths fail, so the caller can report that honestly.
 */
export async function copyText(text: string, clipboard: ClipboardAccess): Promise<boolean> {
  try {
    await clipboard.writeText(text)
    return true
  } catch {
    return clipboard.copyViaSelection(text)
  }
}

/** The real browser clipboard: the async API plus the legacy command as a fallback. */
export function browserClipboard(): ClipboardAccess {
  return {
    // A missing navigator.clipboard throws here, rejecting exactly like a blocked write does.
    writeText: async (text) => navigator.clipboard.writeText(text),
    copyViaSelection,
  }
}

/**
 * Selects `text` in an offscreen read-only field and runs the legacy copy
 * command. WebViews that block the async API often still honour this one.
 * Reports whether the command claimed success; the field is always removed.
 */
export function copyViaSelection(text: string): boolean {
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.top = '0'
  field.style.opacity = '0'
  document.body.append(field)
  try {
    field.focus()
    // select() alone does not select in the iOS WebView; the range form does.
    field.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}
