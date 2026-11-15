import * as v from 'valibot'
import type { JsonValue } from './json.ts'
import {
  JsonValueSchema,
  asJsonObject,
  describeIssues,
  parseJson,
  readNumber,
  readString,
} from './json.ts'
import { redactText } from './redact.ts'

/**
 * One captured page event, as the debug client reports it. Fields are optional
 * because each `type` uses its own subset; formatting branches on `type`.
 */
export interface DebugEvent {
  type: string
  receivedAt?: number
  /** Lifecycle: load, navigate, visibility. */
  event?: string
  url?: string
  title?: string
  visible?: boolean
  /** Console level: log, warn, error. */
  level?: string
  args?: JsonValue[]
  message?: string
  source?: string
  line?: number
  column?: number
  stack?: string
  /** Network request pieces. */
  method?: string
  status?: number
  duration?: number
  requestBody?: JsonValue
  responseBody?: JsonValue
  /** Fetch failure text, when the request never answered. */
  error?: string
  /** Bridge protocol pieces. */
  direction?: string
  protocol?: string
  callbackName?: string
  data?: JsonValue
}

/** Event types the debug client emits; anything else is formatted generically. */
export const DEBUG_EVENT_TYPES = ['lifecycle', 'network', 'console', 'bridge', 'error'] as const

const DebugEventSchema = v.object({
  type: v.string(),
  receivedAt: v.optional(v.number()),
  event: v.optional(v.string()),
  url: v.optional(v.string()),
  title: v.optional(v.string()),
  visible: v.optional(v.boolean()),
  level: v.optional(v.string()),
  args: v.optional(v.array(JsonValueSchema)),
  message: v.optional(v.string()),
  source: v.optional(v.string()),
  line: v.optional(v.number()),
  column: v.optional(v.number()),
  stack: v.optional(v.string()),
  method: v.optional(v.string()),
  status: v.optional(v.number()),
  duration: v.optional(v.number()),
  requestBody: v.optional(JsonValueSchema),
  responseBody: v.optional(JsonValueSchema),
  error: v.optional(v.string()),
  direction: v.optional(v.string()),
  protocol: v.optional(v.string()),
  callbackName: v.optional(v.string()),
  data: v.optional(JsonValueSchema),
})

/** One JSONL line's decode outcome: an event, a reason, or a blank line. */
export interface ParsedEventLine {
  event?: DebugEvent
  reason?: string
}

/** What reading an events file yields, malformed lines counted apart. */
export interface EventsFileRead {
  events: DebugEvent[]
  skipped: number
}

/** Filter outcome: everything that matched, plus the tail that gets shown. */
export interface EventSelection {
  matched: DebugEvent[]
  selected: DebugEvent[]
}

/**
 * Decodes one JSONL line into a debug event. Returns `undefined` for blank
 * lines and, with the reason, for lines that are not an event object.
 */
export function parseDebugEvent(line: string): ParsedEventLine {
  const text = line.trim()
  if (text === '') return {}
  const raw = parseJson(text)
  if (raw === undefined) return { reason: 'not JSON' }
  const decoded = v.safeParse(DebugEventSchema, raw)
  if (!decoded.success) return { reason: describeIssues(decoded.issues) }
  return { event: decoded.output }
}

/**
 * Reads a JSONL event file written by the debug server. Malformed lines are
 * skipped and counted, so one bad write never hides the rest of the capture.
 */
export function readEventsFile(content: string): EventsFileRead {
  const events: DebugEvent[] = []
  let skipped = 0
  for (const line of content.split('\n')) {
    const { event, reason } = parseDebugEvent(line)
    if (event) events.push(event)
    else if (reason) skipped += 1
  }
  return { events, skipped }
}

/** Counts events per type, in first-seen order. */
export function countByType(events: DebugEvent[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const event of events) {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1)
  }
  return counts
}

/**
 * Picks the events matching the filters and keeps the last `limit` of them.
 * `query` matches anywhere in the event's JSON, case-insensitively.
 */
export function selectEvents(
  events: DebugEvent[],
  filters: { type?: string; query?: string; limit: number },
): EventSelection {
  const needle = filters.query?.toLowerCase()
  const matched = events.filter((event) => {
    if (filters.type !== undefined && event.type !== filters.type) return false
    if (
      needle !== undefined &&
      needle !== '' &&
      !JSON.stringify(event).toLowerCase().includes(needle)
    ) {
      return false
    }
    return true
  })
  return { matched, selected: matched.slice(-filters.limit) }
}

/** One bridge message reduced to timeline fields; payloads stay out. */
export interface BridgeTimelineEntry {
  receivedAt?: number
  direction?: string
  protocol?: string
  errcode?: number
  errmsg?: string
}

/** One protocol and direction pair with its count, errcodes, and time span. */
export interface BridgeSummaryGroup {
  protocol: string
  direction: string
  count: number
  errcodes: Record<string, number>
  firstAt?: number
  lastAt?: number
}

/** The bridge capture as a whole, for the events tool header. */
export interface BridgeSummary {
  total: number
  groups: BridgeSummaryGroup[]
  nonZeroErrcodes: Record<string, number>
}

/** What a piece of rendered UI text agreed with. */
export interface UiCaptureAgreement {
  text: string
  agreed: boolean
  source?: 'bridge' | 'network'
  protocol?: string
  direction?: string
  receivedAt?: number
}

/** The reply code fields a bridge payload can carry. */
interface BridgeReplyFields {
  errcode?: number
  errmsg?: string
}

/** Reads `errcode` and a redacted `errmsg` from a bridge reply's data. */
function bridgeReplyFields(event: DebugEvent): BridgeReplyFields {
  const data = asJsonObject(event.data)
  if (data === undefined) return {}
  const errmsg = readString(data, 'errmsg')
  return {
    errcode: readNumber(data, 'errcode'),
    errmsg: errmsg === undefined ? undefined : truncate(redactText(errmsg)),
  }
}

/** Lists the bridge events in arrival order with their reply codes. */
export function bridgeTimeline(events: DebugEvent[]): BridgeTimelineEntry[] {
  return events
    .filter((event) => event.type === 'bridge')
    .map((event) => ({
      receivedAt: event.receivedAt,
      direction: event.direction,
      protocol: event.protocol,
      ...bridgeReplyFields(event),
    }))
}

/** Groups the bridge timeline by protocol and direction, newest count included. */
export function summarizeBridge(events: DebugEvent[]): BridgeSummary {
  const groups = new Map<string, BridgeSummaryGroup>()
  const nonZeroErrcodes: Record<string, number> = {}
  let total = 0
  for (const entry of bridgeTimeline(events)) {
    total += 1
    const protocol = entry.protocol ?? '?'
    const direction = entry.direction ?? '?'
    const key = `${protocol}\u0000${direction}`
    let group = groups.get(key)
    if (group === undefined) {
      group = {
        protocol,
        direction,
        count: 0,
        errcodes: {},
        firstAt: entry.receivedAt,
        lastAt: entry.receivedAt,
      }
      groups.set(key, group)
    }
    group.count += 1
    if (group.firstAt === undefined) group.firstAt = entry.receivedAt
    if (entry.receivedAt !== undefined) group.lastAt = entry.receivedAt
    if (entry.errcode !== undefined) {
      const code = String(entry.errcode)
      group.errcodes[code] = (group.errcodes[code] ?? 0) + 1
      if (entry.errcode !== 0) {
        nonZeroErrcodes[code] = (nonZeroErrcodes[code] ?? 0) + 1
      }
    }
  }
  return { total, groups: [...groups.values()], nonZeroErrcodes }
}

/** Formats the bridge summary as a header line plus one line per group. */
export function formatBridgeSummary(summary: BridgeSummary): string[] {
  if (summary.total === 0) return []
  const codes = Object.entries(summary.nonZeroErrcodes)
  const errcodeText =
    codes.length === 0
      ? ''
      : `, non-zero errcodes ${codes.map(([code, count]) => `${code}x${count}`).join(',')}`
  return [
    `bridge summary: ${summary.total} events${errcodeText}`,
    ...summary.groups.map((group) => {
      const errcodes = Object.entries(group.errcodes)
      const codeText =
        errcodes.length === 0
          ? ''
          : ` errcodes ${errcodes.map(([code, count]) => `${code}x${count}`).join(',')}`
      const span =
        group.firstAt === undefined
          ? ''
          : ` first ${new Date(group.firstAt).toISOString()} last ${new Date(group.lastAt ?? group.firstAt).toISOString()}`
      return `  ${group.protocol} ${group.direction} x${group.count}${codeText}${span}`
    }),
  ]
}

/** Formats the newest `limit` timeline entries, noting any earlier ones. */
export function formatBridgeTimeline(entries: BridgeTimelineEntry[], limit = 20): string[] {
  if (entries.length === 0) return []
  const shown = entries.slice(-limit)
  const hidden = entries.length - shown.length
  const lines = shown.map((entry) => {
    const errcode = entry.errcode === undefined ? '' : ` errcode ${entry.errcode}`
    const errmsg = entry.errmsg === undefined ? '' : ` ${entry.errmsg}`
    return `  ${formatClockMs(entry.receivedAt)}${entry.direction ?? '?'} ${entry.protocol ?? '?'}${errcode}${errmsg}`
  })
  return hidden > 0 ? [`  (+${hidden} earlier)`, ...lines] : lines
}

/**
 * Checks rendered UI text against the capture. A bridge reply is the closest
 * evidence (it fed the screen); a network response body is the fallback. Both
 * are redacted before matching, so a credential can never count as agreement.
 */
export function agreeUiCapture(text: string, events: DebugEvent[]): UiCaptureAgreement {
  const needle = text.trim().toLowerCase()
  if (needle === '') return { text, agreed: false }

  const bridgeReplies = events.filter(
    (event) => event.type === 'bridge' && event.direction === 'receive',
  )
  for (let index = bridgeReplies.length - 1; index >= 0; index -= 1) {
    const event = bridgeReplies[index]
    if (event?.data === undefined) continue
    if (!redactText(event.data).toLowerCase().includes(needle)) continue
    return {
      text,
      agreed: true,
      source: 'bridge',
      protocol: event.protocol,
      direction: event.direction,
      receivedAt: event.receivedAt,
    }
  }

  const networkReplies = events.filter(
    (event) => event.type === 'network' && event.responseBody !== undefined,
  )
  for (let index = networkReplies.length - 1; index >= 0; index -= 1) {
    const event = networkReplies[index]
    if (event?.responseBody === undefined) continue
    if (!redactText(event.responseBody).toLowerCase().includes(needle)) continue
    return { text, agreed: true, source: 'network', receivedAt: event.receivedAt }
  }

  return { text, agreed: false }
}

/** One line an agent can quote as the UI and capture agreement check. */
export function formatAgreement(agreement: UiCaptureAgreement, eventCount: number): string {
  if (!agreement.agreed) {
    return `not agreed: ${JSON.stringify(agreement.text)} appears in no bridge reply or network response body (${eventCount} events)`
  }
  const where =
    agreement.source === 'bridge'
      ? `bridge ${agreement.direction ?? '?'} ${agreement.protocol ?? '?'}`
      : 'a network response body'
  const at =
    agreement.receivedAt === undefined ? '' : ` at ${formatClockMs(agreement.receivedAt).trim()}`
  return `agreed: ${JSON.stringify(agreement.text)} appears in ${where}${at}`
}

/** Longest rendered piece of a single value before it is cut off. */
const VALUE_LIMIT = 240

/** Cuts rendered text at `limit` and reports how much was dropped. */
export function truncateText(text: string, limit: number): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}...(+${(text.length - limit).toLocaleString('en-US')} chars)`
}

/** Cuts a rendered string with the per-value limit and reports the drop. */
function truncate(text: string): string {
  return truncateText(text, VALUE_LIMIT)
}

/** Renders one JSON value for display, credentials withheld. */
function formatValue(value: JsonValue | undefined): string {
  if (value === undefined) return ''
  return truncate(redactText(value))
}

/** Renders one URL for display, credential query parameters withheld. */
function formatUrl(url: string | undefined): string {
  return url === undefined ? '' : redactText(url)
}

/** Renders the wall-clock `HH:MM:SS` part of a timestamp. */
function formatTime(ms: number): string {
  const date = new Date(ms)
  const part = (value: number) => String(value).padStart(2, '0')
  return `${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`
}

/** Renders a wall-clock `HH:MM:SS.fff` prefix for the event's arrival time. */
function formatClockMs(ms: number | undefined): string {
  if (ms === undefined) return ''
  const millis = String(new Date(ms).getMilliseconds()).padStart(3, '0')
  return `${formatTime(ms)}.${millis} `
}

/** Renders a wall-clock `HH:MM:SS` prefix for the event's arrival time. */
function formatClock(ms: number | undefined): string {
  return ms === undefined ? '' : `${formatTime(ms)} `
}

/** Formats one event as a single human-readable line, credentials withheld. */
export function formatDebugEvent(event: DebugEvent): string {
  const at = formatClock(event.receivedAt)
  if (event.type === 'lifecycle') {
    const visibility =
      event.visible === false ? ' (background)' : event.visible === true ? ' (foreground)' : ''
    return `${at}${event.event ?? 'event'}  ${formatUrl(event.url)}${visibility}`
  }
  if (event.type === 'network') {
    const failure = event.error ? ` ERROR: ${event.error}` : ''
    const status = event.status === undefined ? '-' : String(event.status)
    const duration = event.duration === undefined ? '-' : String(event.duration)
    return `${at}[${event.method ?? 'GET'} ${status} ${duration}ms] ${formatUrl(event.url)}${failure}`
  }
  if (event.type === 'console') {
    const parts = (event.args ?? []).map((arg) => formatValue(arg)).filter((arg) => arg !== '')
    return `${at}[console:${event.level ?? 'log'}] ${parts.join(' ')}`
  }
  if (event.type === 'bridge') {
    const callback = event.callbackName ? ` callback=${event.callbackName}` : ''
    return `${at}[bridge:${event.direction ?? '?'}] ${event.protocol ?? '?'}${callback} ${formatValue(event.data)}`
  }
  if (event.type === 'error') {
    const where = event.source
      ? ` (${event.source}:${event.line ?? '?'}:${event.column ?? '?'})`
      : ''
    return `${at}[JS ERROR] ${truncate(event.message ?? 'Unknown error')}${where}`
  }
  const raw = parseJson(JSON.stringify(event))
  return `${at}[${event.type}] ${raw === undefined ? '' : truncate(redactText(raw))}`
}
