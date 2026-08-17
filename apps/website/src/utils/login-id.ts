export function parseLoginId(search: string): number | null {
  const value = new URLSearchParams(search).get('login-id')
  if (!value || !/^[1-9]\d*$/.test(value)) return null

  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

export function getLoginId(): number | null {
  return parseLoginId(window.location.search)
}
