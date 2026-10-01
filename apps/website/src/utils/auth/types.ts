export interface CredentialSession {
  token: string
  userId?: number
  account?: string
  source?: 'bridge' | 'credentials'
}

export interface SavedLoginCredentials {
  account: string
  password: string
  userId?: number
}

export interface AccountProfile {
  userId: number
  num: string
  nick: string
  avatar: string
}

export interface SavedAccount {
  key: string
  userId?: number
  account?: string
  num: string
  nick: string
  avatar: string
  bridge: boolean
}
