import { safeParse } from 'valibot'
import { describe, expect, it } from 'vite-plus/test'
import {
  descriptionSchema,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  nameSchema,
} from './field-schema'

const nameMessages = { tooLong: 'too long', singleLine: 'single line' }
const requiredNameMessages = { required: 'required', ...nameMessages }

describe('nameSchema', () => {
  it('trims both ends', () => {
    const result = safeParse(nameSchema(nameMessages), '  Team  ')
    expect(result.success ? result.output : null).toBe('Team')
  })

  it('caps the length at the trimmed value', () => {
    const atLimit = `  ${'a'.repeat(MAX_NAME_LENGTH)}  `
    expect(safeParse(nameSchema(nameMessages), atLimit).success).toBe(true)
    expect(safeParse(nameSchema(nameMessages), 'a'.repeat(MAX_NAME_LENGTH + 1)).success).toBe(false)
  })

  it('rejects line breaks, tabs, and other control characters', () => {
    expect(safeParse(nameSchema(nameMessages), 'two\nlines').success).toBe(false)
    expect(safeParse(nameSchema(nameMessages), 'two\ttabs').success).toBe(false)
  })

  it('leaves emoji and inner spaces alone', () => {
    expect(safeParse(nameSchema(nameMessages), 'Team 🎉').success).toBe(true)
  })

  it('rejects an empty value only when a required message is given', () => {
    expect(safeParse(nameSchema(requiredNameMessages), '   ').success).toBe(false)
    expect(safeParse(nameSchema(nameMessages), '   ').success).toBe(true)
  })
})

describe('descriptionSchema', () => {
  it('trims both ends and keeps line breaks', () => {
    const result = safeParse(descriptionSchema({ tooLong: 'too long' }), '  first\nsecond  ')
    expect(result.success ? result.output : null).toBe('first\nsecond')
  })

  it('caps the length at the trimmed value', () => {
    const messages = { tooLong: 'too long' }
    expect(safeParse(descriptionSchema(messages), 'a'.repeat(MAX_DESCRIPTION_LENGTH)).success).toBe(
      true,
    )
    expect(
      safeParse(descriptionSchema(messages), 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1)).success,
    ).toBe(false)
  })

  it('rejects an empty value only when a required message is given', () => {
    const messages = { tooLong: 'too long' }
    expect(safeParse(descriptionSchema(messages), '').success).toBe(true)
    expect(safeParse(descriptionSchema({ ...messages, required: 'required' }), '').success).toBe(
      false,
    )
  })
})
