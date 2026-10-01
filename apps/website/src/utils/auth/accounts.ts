import type { SavedAccount } from './types'

/** User IDs merge Bridge and password sign-ins; legacy credentials merge by account name. */
export function mergeAccount(accounts: SavedAccount[], incoming: SavedAccount): SavedAccount[] {
  const matches = accounts.filter(
    (saved) =>
      saved.key === incoming.key ||
      (incoming.account !== undefined && saved.account === incoming.account),
  )
  const merged = matches.reduce(
    (account, saved) => ({
      ...saved,
      ...account,
      account: account.account ?? saved.account,
      bridge: account.bridge || saved.bridge,
    }),
    incoming,
  )
  return [merged, ...accounts.filter((saved) => !matches.includes(saved))]
}
