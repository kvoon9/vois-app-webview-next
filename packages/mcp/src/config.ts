import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/** Account handed to the debug server when a login names no account. */
export interface DebugCredentials {
  account: string
  password: string
  countryCode: string
}

/** Everything the tools need; resolved once at startup. */
export interface ResolvedConfig {
  /** Ports probed for a live debug server, in order. */
  ports: number[]
  /** JSONL capture the debug server appends to. */
  eventsFile: string
  /** API origin the signed calls target. */
  apiBase: string
  /** Pair that signs HTTP API queries, as the app bundle does. */
  appId: string
  appKey: string
  /** Account a no-argument login re-signs. */
  fixedAccount: DebugCredentials
}

/** CLI and env overrides that beat every default. */
export interface CliOverrides {
  ports?: number[]
  eventsFile?: string
}

/** Ports the repo's own workflows use: dev, debug preview, production preview. */
export const DEFAULT_PORTS = [3021, 5173, 8080]

/** Where the website's proxy points when no env override exists. */
export const DEFAULT_API_BASE = 'https://api.voischat.cn'

/**
 * The app's own BuildConfig pair, exactly what `voisBridgeAuth` defaults to.
 * Override with `VITE_APP_ID` / `VITE_APP_KEY` when targeting another backend.
 */
const APP_ID = '102070'
const APP_KEY = 'f956a4edc886d8402807a60f89a4a626'

/**
 * The throwaway debug account from `@vois/webview-bridge`
 * (`DEFAULT_DEBUG_CREDENTIALS`); keep the two in sync on purpose.
 */
const FIXED_ACCOUNT: DebugCredentials = {
  account: '16675441248',
  password: '30215594',
  countryCode: '86',
}

/** Parses a `.env` file's `KEY=VALUE` lines, ignoring comments and blanks. */
export function parseEnvFile(text: string): Map<string, string> {
  const values = new Map<string, string>()
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue
    values.set(trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim())
  }
  return values
}

/** Walks up from `startDir` until a directory holding `pnpm-workspace.yaml`. */
export function findRepoRoot(startDir: string): string | undefined {
  let current = resolve(startDir)
  while (true) {
    if (readFileIfPresent(join(current, 'pnpm-workspace.yaml')) !== undefined) return current
    const parent = resolve(current, '..')
    if (parent === current) return undefined
    current = parent
  }
}

/** Reads a file only when it exists, so callers can chain a fallback. */
function readFileIfPresent(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

/**
 * Resolves the tool configuration. `process.env` beats `~/.vois/.env`, which
 * beats the built-in pair, mirroring how `loadEnv` treats the two sources.
 * `voisEnvPath` replaces `~/.vois/.env`, mostly so tests can pin a fixture.
 */
export function resolveConfig(
  env: NodeJS.ProcessEnv,
  overrides: CliOverrides = {},
  voisEnvPath: string = join(homedir(), '.vois', '.env'),
): ResolvedConfig {
  const envFile = parseEnvFile(readFileIfPresent(voisEnvPath) ?? '')
  const ports = overrides.ports?.length
    ? overrides.ports
    : (readPortList(env.VOIS_DEBUG_PORTS) ?? DEFAULT_PORTS)
  const eventsFile = overrides.eventsFile ?? env.VOIS_DEBUG_EVENTS_FILE ?? defaultEventsFile()

  return {
    ports,
    eventsFile,
    apiBase: env.VOIS_API_BASE ?? DEFAULT_API_BASE,
    appId: env.VOIS_APP_ID ?? env.VITE_APP_ID ?? envFile.get('VITE_APP_ID') ?? APP_ID,
    appKey: env.VOIS_APP_KEY ?? env.VITE_APP_KEY ?? envFile.get('VITE_APP_KEY') ?? APP_KEY,
    fixedAccount: {
      account: env.VOIS_DEBUG_ACCOUNT ?? FIXED_ACCOUNT.account,
      password: env.VOIS_DEBUG_PASSWORD ?? FIXED_ACCOUNT.password,
      countryCode: env.VOIS_DEBUG_COUNTRY_CODE ?? FIXED_ACCOUNT.countryCode,
    },
  }
}

/** Parses a comma-separated port list; `undefined` when nothing parses. */
function readPortList(raw: string | undefined): number[] | undefined {
  if (raw === undefined) return undefined
  const ports = raw
    .split(',')
    .map((piece) => Number.parseInt(piece.trim(), 10))
    .filter((port) => Number.isInteger(port) && port > 0 && port < 65536)
  return ports.length > 0 ? ports : undefined
}

/** Events live in the website app's Vite root, three levels below the repo. */
function defaultEventsFile(): string {
  const here = findRepoRoot(import.meta.dirname ?? '.')
  return here === undefined
    ? ''
    : join(here, 'apps', 'website', '.tmp', 'vois-webview-debug', 'events.jsonl')
}
