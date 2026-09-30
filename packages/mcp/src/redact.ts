import type { JsonObject, JsonValue } from './json.ts'
import { asJsonObject, decodeField } from './json.ts'
import * as v from 'valibot'

/** Replacement shown wherever a credential value used to be. */
export const REDACTED = '[redacted]'

/**
 * Keys whose whole value is withheld. Matches the app's own bridge-log redaction
 * (`access-token` / `accessToken` / `token`) plus the password family.
 */
const SENSITIVE_KEYS = new Set([
  'access-token',
  'accesstoken',
  'authorization',
  'password',
  'secret',
  'token',
])

/** Query parameter names stripped from URL-shaped strings. */
const SENSITIVE_QUERY_PARAMS = new Set(['access-token', 'password', 'token'])

/** True when a key names a credential and its value must be withheld. */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase())
}

/** Replaces sensitive query parameters in an absolute or path-shaped URL string. */
function redactUrlText(text: string): string {
  try {
    const url = new URL(text)
    let changed = false
    for (const name of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_PARAMS.has(name.toLowerCase())) {
        url.searchParams.set(name, REDACTED)
        changed = true
      }
    }
    return changed ? url.toString() : text
  } catch {
    const queryStart = text.indexOf('?')
    if (queryStart === -1) return text
    const params = new URLSearchParams(text.slice(queryStart + 1))
    let changed = false
    for (const name of Array.from(params.keys())) {
      if (SENSITIVE_QUERY_PARAMS.has(name.toLowerCase())) {
        params.set(name, REDACTED)
        changed = true
      }
    }
    return changed ? `${text.slice(0, queryStart)}?${params.toString()}` : text
  }
}

/** Copies one object with its credential keys withheld. */
function redactObject(object: JsonObject): JsonObject {
  const copy: JsonObject = {}
  for (const [key, item] of Object.entries(object)) {
    copy[key] = isSensitiveKey(key) ? REDACTED : redactJson(item)
  }
  return copy
}

/**
 * Copies a JSON value with every credential withheld: sensitive object keys
 * collapse to `[redacted]`, and sensitive query parameters disappear from
 * URL-shaped strings. Parsed JSON is acyclic, so no cycle guard is needed.
 */
export function redactJson(value: JsonValue): JsonValue {
  const text = decodeField(v.string(), value)
  if (text !== undefined) return redactUrlText(text)
  if (Array.isArray(value)) return value.map((item) => redactJson(item))
  const object = asJsonObject(value)
  return object === undefined ? value : redactObject(object)
}

/** Formats any JSON value for display, with credentials withheld. */
export function redactText(value: JsonValue | undefined): string {
  if (value === undefined) return ''
  const text = decodeField(v.string(), value)
  if (text !== undefined) return redactUrlText(text)
  return JSON.stringify(redactJson(value))
}
