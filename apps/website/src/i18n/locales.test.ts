import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { array, is, lazy, parse, record, string, union } from 'valibot'
import type { GenericSchema } from 'valibot'
import { describe, expect, it } from 'vite-plus/test'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'

/**
 * A locale entry nothing renders never shows up in review. It outlives the UI
 * that used it, in all three files at once, so it is checked here instead.
 * `vp lint` cannot do it: oxlint does not read `.vue`, and a rule only ever sees
 * the one file it runs on.
 *
 * A key counts as used when its text appears in the source, or when a `t()` /
 * `tm()` template can produce it. Those templates fill their holes from the
 * source's own literals, so `t(`device.roles.${section}`)` next to
 * `['admin', 'member']` vouches for `device.roles.admin`, while an unrelated
 * dynamic string cannot vouch for every key at once.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url))

/** Locale files nest until they end in a message, or in a list of messages. */
interface LocaleMessages {
  [key: string]: string | string[] | LocaleMessages
}

const localeMessages: GenericSchema<LocaleMessages> = lazy(() =>
  record(string(), union([string(), array(string()), localeMessages])),
)

/** Arrays are content rather than names: the key is `reportTarget.reasons`, not `.0`. */
function messageKeys(messages: LocaleMessages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    if (Array.isArray(value)) return []
    return is(string(), value) ? [`${prefix}${key}`] : messageKeys(value, `${prefix}${key}.`)
  })
}

function messagesIn(locale: string | string[] | LocaleMessages): LocaleMessages {
  return parse(localeMessages, locale)
}

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) sourceFiles(path, found)
    else if (/\.(vue|ts)$/.test(path) && !path.endsWith('.test.ts')) found.push(path)
  }
  return found
}

const SOURCES = sourceFiles(SRC).map((file) => readFileSync(file, 'utf8'))
const SOURCE_TEXT = SOURCES.join('\n')

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A hole stands for one path segment, listed here so it cannot stand for any text at all. */
const SEGMENT = `(?:${[
  ...new Set(
    [...SOURCE_TEXT.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)]
      .map((match) => match[1] ?? match[2])
      .filter((value) => /^[A-Za-z][\w-]*$/.test(value)),
  ),
].join('|')})`

/** Templates in a `t()` / `tm()` argument position are the only dynamic keys we can read. */
function dynamicKeyPatterns(text: string): RegExp[] {
  return [...text.matchAll(/(?<![\w.$])(?:t|tm)\(\s*`((?:[^`\\]|\\.)*)`/g)]
    .map((match) => match[1])
    .filter((template) => template.includes('${'))
    .map(
      (template) =>
        new RegExp(
          `^${template
            .split(/\$\{[^}]*\}/)
            .map(escapeRegExp)
            .join(SEGMENT)}$`,
        ),
    )
}

const DYNAMIC_KEYS = SOURCES.flatMap(dynamicKeyPatterns)

function isUsed(key: string): boolean {
  return (
    DYNAMIC_KEYS.some((pattern) => pattern.test(key)) ||
    new RegExp(`${escapeRegExp(key)}(?![\\w.-])`).test(SOURCE_TEXT)
  )
}

const MESSAGES = messagesIn(en)

describe('locales', () => {
  it('has no unused keys', () => {
    const unused = messageKeys(MESSAGES).filter((key) => !isUsed(key))
    expect(unused).toEqual([])
  })

  it('covers the same keys in every locale', () => {
    const reference = messageKeys(MESSAGES).sort()
    expect(messageKeys(messagesIn(zhCN)).sort()).toEqual(reference)
    expect(messageKeys(messagesIn(zhTW)).sort()).toEqual(reference)
  })
})
