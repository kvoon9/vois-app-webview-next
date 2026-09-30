import { maxLength, nonEmpty, pipe, regex, string, trim } from 'valibot'

/** Name fields hold one short line: a group name, a device name, a remark. */
export const MAX_NAME_LENGTH = 16
/** Description fields may wrap: the group introduction, the join application reason. */
export const MAX_DESCRIPTION_LENGTH = 60

/** Valibot's `regex` requires a match, so the name must be control-character free from end to end. */
const CONTROL_CHARACTER_FREE = /^[^\p{Cc}]*$/u

export interface FieldMessages {
  /** Reject an empty value; omit it to let the field be cleared, the way a nickname allows. */
  required?: string
  tooLong: string
}

export interface NameMessages extends FieldMessages {
  singleLine: string
}

/**
 * Name rules: trim both ends, cap the length, and keep the value on one line.
 *
 * The messages come from the caller because Valibot's own i18n reads like debug
 * output (「无效的长度：预期为 16」), not like something to hand a user.
 */
export function nameSchema(messages: NameMessages) {
  const name = pipe(
    string(),
    trim(),
    maxLength(MAX_NAME_LENGTH, messages.tooLong),
    regex(CONTROL_CHARACTER_FREE, messages.singleLine),
  )
  return messages.required ? pipe(name, nonEmpty(messages.required)) : name
}

/** Description rules: trim both ends and cap the length; line breaks are allowed. */
export function descriptionSchema(messages: FieldMessages) {
  const description = pipe(string(), trim(), maxLength(MAX_DESCRIPTION_LENGTH, messages.tooLong))
  return messages.required ? pipe(description, nonEmpty(messages.required)) : description
}
