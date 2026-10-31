import { fallback, nullish, object, safeParse, string } from 'valibot'

/** One selectable text label: display text plus optional emoji or icon decoration. */
export interface ChipOption {
  text: string
  /** Unicode emoji rendered before the text, e.g. 💬. */
  emoji?: string
  /** UnoCSS icon class, e.g. `i-ph-user-circle`. Rendered as a mask icon in currentColor. */
  icon?: string
}

/**
 * Locale entries may still be plain strings (older locales) or `{ text, emoji,
 * icon }` objects, and the two shapes mix within one list. The `fallback`s
 * degrade a wrong-typed emoji or icon to absence instead of rejecting the whole
 * entry, so a malformed decoration can never break the form that renders it.
 */
const chipOptionSchema = object({
  text: string(),
  emoji: fallback(nullish(string()), undefined),
  icon: fallback(nullish(string()), undefined),
})

/** Decodes one chip list entry from `tm()` output so callers can trust `ChipOption`. */
export function toChipOption(entry: string | ChipOption): ChipOption {
  const parsed = safeParse(chipOptionSchema, entry)
  if (parsed.success) {
    return {
      text: parsed.output.text,
      emoji: parsed.output.emoji ?? undefined,
      icon: parsed.output.icon ?? undefined,
    }
  }
  // Out-of-contract values (no usable text) still need a label; String() keeps
  // real strings byte-identical.
  return { text: String(entry) }
}

/**
 * Decodes a whole `tm()` answer. vue-i18n hands back an index-keyed object when
 * the locale entry is not a plain array, and a missing key is undefined; both
 * contribute no chips rather than throwing.
 */
export function toChipOptions(
  entries: readonly (string | ChipOption)[] | Record<string, string | ChipOption> | undefined,
): ChipOption[] {
  const list = Array.isArray(entries) ? entries : entries ? Object.values(entries) : []
  return list.map(toChipOption)
}
