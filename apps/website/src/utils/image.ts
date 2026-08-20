// Collapse to the local fallback text when a remote avatar fails to load
export function hideBrokenImage(event: Event): void {
  const image = event.currentTarget
  if (image instanceof HTMLImageElement) image.hidden = true
}
