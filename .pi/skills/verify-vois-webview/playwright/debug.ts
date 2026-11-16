import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import {
  agreeUiCapture,
  findRepoRoot,
  probeDebugServer,
  readEventsFile,
  type DebugEvent,
  type UiCaptureAgreement,
} from '../../../../packages/mcp/src/index.ts'

/** Which captured call to wait for. `path` compares the URL pathname exactly. */
export interface NetworkMatch {
  method?: string
  path: string
}

/** Which bridge message to wait for. */
export interface BridgeMatch {
  direction?: 'send' | 'receive'
  protocol: string
}

/** The capture as one verification run sees it. */
export interface DebugCapture {
  readonly port: number
  readonly sessionStartedAt: number
  readonly eventsFile: string
  /** The event count now, to slice off what a later step produced. */
  mark(): number
  since(mark: number): DebugEvent[]
  waitForNetwork(match: NetworkMatch, from: number, timeoutMs?: number): Promise<DebugEvent>
  waitForBridge(match: BridgeMatch, from: number, timeoutMs?: number): Promise<DebugEvent>
  agree(text: string, events: DebugEvent[]): UiCaptureAgreement
  /** Throws when the server restarted, because the capture then belongs to another instance. */
  assertSameSession(): Promise<void>
}

const POLL_MS = 250

function repoRoot(): string {
  const root = findRepoRoot(import.meta.dirname)
  if (root === undefined) throw new Error(`no pnpm-workspace.yaml above ${import.meta.dirname}`)
  return root
}

/** The pathname of a captured URL, or undefined when the event carries none. */
export function pathnameOf(event: DebugEvent): string | undefined {
  if (event.url === undefined) return undefined
  try {
    return new URL(event.url, 'http://localhost').pathname
  } catch {
    return undefined
  }
}

function matchesNetwork(event: DebugEvent, match: NetworkMatch): boolean {
  if (event.type !== 'network') return false
  if (match.method !== undefined && event.method !== match.method) return false
  return pathnameOf(event) === match.path
}

function matchesBridge(event: DebugEvent, match: BridgeMatch): boolean {
  if (event.type !== 'bridge') return false
  if (match.direction !== undefined && event.direction !== match.direction) return false
  return event.protocol === match.protocol
}

/** One line that identifies the event in a timeout message. */
function summarizeEvent(event: DebugEvent, kind: 'network' | 'bridge'): string {
  if (kind === 'network') {
    return `${event.method ?? '?'} ${pathnameOf(event) ?? '?'} ${event.status ?? event.error ?? ''}`
  }
  return `${event.direction ?? '?'} ${event.protocol ?? '?'}`
}

/**
 * Opens the capture for one DevServer instance. Fails before a spec drives
 * anything when no debug server answers, so a plain website is never mistaken
 * for the instrumented one.
 */
export async function createDebugCapture(
  port = Number(process.env.VERIFY_PORT ?? 3021),
): Promise<DebugCapture> {
  const eventsFile = join(repoRoot(), 'apps/website/.tmp/vois-webview-debug/events.jsonl')
  const status = await probeDebugServer(port)
  if (status === null) {
    throw new Error(
      `no debug server on port ${port}; start one with: cd apps/website && vp dev --host --port ${port}`,
    )
  }
  const sessionStartedAt = status.sessionStartedAt

  function readEvents(): DebugEvent[] {
    try {
      return readEventsFile(readFileSync(eventsFile, 'utf8')).events
    } catch {
      return []
    }
  }

  async function assertSameSession(): Promise<void> {
    const now = await probeDebugServer(port)
    if (now === null) throw new Error(`the debug server on port ${port} stopped`)
    if (now.sessionStartedAt !== sessionStartedAt) {
      throw new Error(
        `the debug server restarted; the capture before ${now.sessionStartedAt} is stale`,
      )
    }
  }

  async function waitForEvent(
    from: number,
    kind: 'network' | 'bridge',
    matches: (event: DebugEvent) => boolean,
    label: string,
    timeoutMs: number,
  ): Promise<DebugEvent> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const found = readEvents().slice(from).filter(matches).at(-1)
      if (found !== undefined) return found
      await delay(POLL_MS)
    }
    await assertSameSession()
    const seen = readEvents()
      .slice(from)
      .filter((event) => event.type === kind)
      .slice(-5)
      .map((event) => summarizeEvent(event, kind))
    throw new Error(
      `no ${label} captured in ${timeoutMs}ms; last ${kind} events: ${seen.join(', ') || 'none'}`,
    )
  }

  return {
    port,
    sessionStartedAt,
    eventsFile,
    mark: () => readEvents().length,
    since: (mark) => readEvents().slice(mark),
    waitForNetwork: (match, from, timeoutMs = 30_000) =>
      waitForEvent(
        from,
        'network',
        (event) => matchesNetwork(event, match),
        `${match.method ?? 'any'} ${match.path}`,
        timeoutMs,
      ),
    waitForBridge: (match, from, timeoutMs = 30_000) =>
      waitForEvent(
        from,
        'bridge',
        (event) => matchesBridge(event, match),
        `${match.direction ?? 'any'} ${match.protocol}`,
        timeoutMs,
      ),
    agree: (text, events) => agreeUiCapture(text, events),
    assertSameSession,
  }
}
