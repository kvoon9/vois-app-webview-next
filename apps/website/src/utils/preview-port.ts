/** Build the same page on another debug-preview port, or null when the input is not a port. */
export function previewPortHref(port: string, url: URL): string | null {
  const trimmed = port.trim()
  if (!/^\d+$/.test(trimmed)) return null

  const parsed = Number(trimmed)
  if (parsed < 1 || parsed > 65535) return null

  // A fresh URL rather than mutating the caller's, and no hostname in sight:
  // the phone reaches the Mac by IP, so the port is the only thing that changes.
  const next = new URL(url.href)
  next.port = String(parsed)
  return next.href
}
