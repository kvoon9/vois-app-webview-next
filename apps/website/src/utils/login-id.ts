let capturedLoginId: number | null = null

export function parseLoginId(source: string): number | null {
  const queryStart = source.indexOf('?')
  const search = queryStart === -1 ? source : source.slice(queryStart)
  const value = new URLSearchParams(search).get('login-id')
  if (!value || !/^[1-9]\d*$/.test(value)) return null

  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

export function captureLoginId(...sources: string[]): void {
  for (const source of sources) {
    const id = parseLoginId(source)
    if (id == null) continue

    capturedLoginId = id
    return
  }
}

export function getLoginId(): number | null {
  return (
    capturedLoginId ?? parseLoginId(window.location.search) ?? parseLoginId(window.location.hash)
  )
}
