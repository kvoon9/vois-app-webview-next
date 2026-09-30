import * as v from 'valibot'

/** Any JSON-representable value; the common currency of events and RPC payloads. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/** Parsed form of a `Record<string, JsonValue>` for schema-checked objects. */
export type JsonObject = { [key: string]: JsonValue }

/** Minimal shape of a schema issue, wide enough for every valibot result here. */
type IssueLike = v.BaseIssue<unknown>

/**
 * Schema for any JSON value. Arrays come before records so an array is never
 * mistaken for an object with numeric keys.
 */
export const JsonValueSchema: v.GenericSchema<JsonValue> = v.lazy(() =>
  v.union([
    v.string(),
    v.number(),
    v.boolean(),
    v.null(),
    v.array(v.lazy(() => JsonValueSchema)),
    v.record(
      v.string(),
      v.lazy(() => JsonValueSchema),
    ),
  ]),
)

/** Decodes a JSON text; returns `undefined` instead of throwing on malformed input. */
export function parseJson(text: string): JsonValue | undefined {
  try {
    const decoded = v.safeParse(JsonValueSchema, JSON.parse(text))
    return decoded.success ? decoded.output : undefined
  } catch {
    return undefined
  }
}

/** Decodes one value against a schema; `undefined` when absent or mismatched. */
export function decodeField<T>(
  schema: v.GenericSchema<T>,
  value: JsonValue | undefined,
): T | undefined {
  if (value === undefined) return undefined
  const decoded = v.safeParse(schema, value)
  return decoded.success ? decoded.output : undefined
}

/** Narrows a JSON value to an object; arrays, null, and primitives fail. */
export function asJsonObject(value: JsonValue | undefined): JsonObject | undefined {
  if (value === undefined || value === null || Array.isArray(value)) return undefined
  return decodeField(v.record(v.string(), JsonValueSchema), value)
}

/** Reads an optional string field from a decoded object. */
export function readString(source: JsonObject, key: string): string | undefined {
  return decodeField(v.string(), source[key])
}

/** Reads an optional number field from a decoded object. */
export function readNumber(source: JsonObject, key: string): number | undefined {
  return decodeField(v.number(), source[key])
}

/** Reads an optional boolean field from a decoded object. */
export function readBoolean(source: JsonObject, key: string): boolean | undefined {
  return decodeField(v.boolean(), source[key])
}

/** Reads an optional nested JSON value from a decoded object. */
export function readValue(source: JsonObject, key: string): JsonValue | undefined {
  return source[key]
}

/** Summarizes the first schema issues as one short, model-readable line. */
export function describeIssues(issues: readonly IssueLike[]): string {
  return issues
    .slice(0, 3)
    .map((issue) => {
      const where = issue.path?.map((item) => String(item.key)).join('.')
      return `${where === undefined || where === '' ? 'value' : where}: ${issue.message}`
    })
    .join('; ')
}
