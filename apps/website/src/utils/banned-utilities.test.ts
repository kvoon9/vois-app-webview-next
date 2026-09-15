import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'
import { createGenerator } from 'unocss'
import unoConfig from '../../uno.config'

/**
 * `blocklist` in uno.config.ts drops banned utilities from the output CSS, but
 * it does so silently: a `grid` written by an agent produces a class with no
 * styles and no error. This check turns that silence into a failure.
 *
 * It scans the class attribute rather than the whole file, because the raw text
 * extractor also picks up unrelated identifiers: `v-slot="{ grid, weekDays }"`
 * in TrackCalendarModal.vue is not a class.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url))
const CLASS_ATTRIBUTE = /(^|\s)(:class|v-bind:class|class)\s*=\s*"([\s\S]*?)"/g
const STRING_LITERAL = /'([^']*)'|"([^"]*)"/g

/** Undo wrapper syntax so `md:!grid` is tested as `grid`, the way the engine sees it. */
function normalizeClass(token: string) {
  let token_ = token
  let depth = 0
  let variantEnd = -1
  for (let i = 0; i < token_.length; i++) {
    const char = token_[i]
    if (char === '[') depth++
    else if (char === ']') depth--
    else if (char === ':' && depth === 0) variantEnd = i
  }
  if (variantEnd >= 0) token_ = token_.slice(variantEnd + 1)
  return token_.replace(/^!/, '')
}

function vueFilesIn(directory: string, found: string[] = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) vueFilesIn(path, found)
    else if (entry.endsWith('.vue')) found.push(path)
  }
  return found
}

/** Static values are a class list; dynamic ones are JS, so only strings in them are classes. */
function classNamesIn(value: string, dynamic: boolean) {
  const values = dynamic
    ? [...value.matchAll(STRING_LITERAL)].map((match) => match[1] ?? match[2] ?? '')
    : [value]
  return values.flatMap((text) => text.split(/\s+/)).filter(Boolean)
}

describe('banned utilities', () => {
  it('are never used in a class attribute', async () => {
    const uno = await createGenerator(unoConfig)
    const offenses: string[] = []

    for (const file of vueFilesIn(SRC)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(CLASS_ATTRIBUTE)) {
        for (const token of classNamesIn(match[3], match[2] !== 'class')) {
          if (uno.isBlocked(normalizeClass(token))) {
            offenses.push(`${relative(SRC, file)}: ${token}`)
          }
        }
      }
    }

    expect(
      offenses,
      'Use flex and space-*/margin instead; grid and gap are unsupported on the Chrome 83 target.',
    ).toEqual([])
  })
})
