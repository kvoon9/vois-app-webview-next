import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { array, is, lazy, parse, record, string, union } from 'valibot'
import type { GenericSchema } from 'valibot'
import { parse as parseComponent } from 'vue/compiler-sfc'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vite-plus/test'
import { SUPPORTED_LOCALES } from './config'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'

/**
 * Locale coverage is checked here instead of in `vp lint`: oxlint does not read
 * `.vue`, and a rule only ever sees the one file it runs on. A key nothing
 * renders outlives the UI that used it, a key nothing defines fails at runtime,
 * and a string written straight into a template never reaches a translator.
 *
 * Dynamic keys are the one place a static check cannot see the value. Each call
 * site that builds a key from data is listed below with every key it can
 * produce, so a new dynamic call fails until its key set is written down.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url))

interface LocaleMessages {
  [key: string]: string | string[] | LocaleMessages
}

const localeMessages: GenericSchema<LocaleMessages> = lazy(() =>
  record(string(), union([string(), array(string()), localeMessages])),
)

/** Arrays are content rather than names: the path is `reportTarget.reasons`, not `.0`. */
function messagePaths(messages: LocaleMessages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    if (Array.isArray(value)) return [`${prefix}${key}`]
    return is(string(), value) ? [`${prefix}${key}`] : messagePaths(value, `${prefix}${key}.`)
  })
}

function messagesIn(locale: string | string[] | LocaleMessages): LocaleMessages {
  return parse(localeMessages, locale)
}

function messageAt(messages: LocaleMessages, key: string): string | string[] | undefined {
  let node: LocaleMessages | string | string[] | undefined = messages
  for (const part of key.split('.')) {
    if (!node || is(string(), node) || Array.isArray(node)) return undefined
    node = node[part]
  }
  return is(string(), node) ? node : Array.isArray(node) ? node : undefined
}

/** A dynamic key and the exact keys its call site can produce. */
const DYNAMIC_KEYS = {
  'components/CategoryReportForm.vue|messages.placeholder': [
    'feedback.placeholder',
    'report.placeholder',
  ],
  'components/CategoryReportForm.vue|messages.section': ['feedback.category', 'report.problemType'],
  'components/CategoryReportForm.vue|messages.submit': ['feedback.submit', 'report.report'],
  'components/CategoryReportForm.vue|messages.textarea': [
    'feedback.yourFeedback',
    'report.whatHappened',
  ],
  'components/CategoryReportForm.vue|messages.title': ['feedback.title', 'report.title'],
  'components/CategoryReportForm.vue|messages.value.list': ['feedback.categories', 'report.types'],
  'components/LanguageSwitcher.vue|OPTION_KEYS[option]': [
    'language.en',
    'language.zh-CN',
    'language.zh-TW',
  ],
  "components/PageHeader.vue|copyFailed ? 'nav.linkCopyFailed' : 'nav.linkCopied'": [
    'nav.linkCopyFailed',
    'nav.linkCopied',
  ],
  'components/ReportTargetForm.vue|TARGET_MESSAGES[props.target].title': [
    'reportTarget.user.title',
    'reportTarget.group.title',
  ],
  'components/ReportTargetForm.vue|TARGET_MESSAGES[target].placeholder': [
    'reportTarget.user.placeholder',
    'reportTarget.group.placeholder',
  ],
  "components/settings/TranslationMultiPage.vue|step.value === 'source' ? 'translation.target' : 'translation.source'":
    ['translation.target', 'translation.source'],
  'components/settings/TranslationMultiPage.vue|side.label': [
    'translation.source',
    'translation.target',
  ],
  'components/settings/TranslationSettingsPage.vue|KIND_TITLES[props.kind]': [
    'settings.friends',
    'settings.groups',
  ],
  "components/settings/TranslationSettingsPage.vue|props.kind === 'friends' ? 'translation.emptyFriends' : 'translation.emptyGroups'":
    ['translation.emptyFriends', 'translation.emptyGroups'],
  "components/settings/TranslationTargetList.vue|item.skill === 2 ? 'translation.skills.premiumZhEn' : 'translation.skills.premiumMulti'":
    ['translation.skills.premiumZhEn', 'translation.skills.premiumMulti'],
  'pages/devices/[id]/groups/[groupId]/members/index.vue|ROLE_LABELS[section]': [
    'device.roles.admin',
    'device.roles.member',
  ],
  'pages/devices/[id]/reminders/[reminderId].vue|key': [
    'device.reminderDayMon',
    'device.reminderDayTue',
    'device.reminderDayWed',
    'device.reminderDayThu',
    'device.reminderDayFri',
    'device.reminderDaySat',
    'device.reminderDaySun',
  ],
  'pages/devices/[id]/track-setting.vue|option.label': [
    'device.frequencyOff',
    'device.frequencyLow',
    'device.frequencyMid',
    'device.frequencyHigh',
  ],
  'pages/settings.vue|section.label': ['settings.friends', 'settings.groups', 'settings.devices'],
  "pages/shared/qrcode/bluetooth-ai-translate-active.vue|activated ? 'bluetoothAiTranslateActive.activated' : 'bluetoothAiTranslateActive.unactivated'":
    ['bluetoothAiTranslateActive.activated', 'bluetoothAiTranslateActive.unactivated'],
  'utils/reminder-repeat-label.ts|DAY_KEYS[day - 1]!': [
    'device.reminderDayMon',
    'device.reminderDayTue',
    'device.reminderDayWed',
    'device.reminderDayThu',
    'device.reminderDayFri',
    'device.reminderDaySat',
    'device.reminderDaySun',
  ],
} as const satisfies Record<string, readonly string[]>

/** Values that are the same in every language on purpose. */
const SAME_ACROSS_LOCALES = new Set([
  'app.title',
  'device.imei',
  'language.en',
  'language.zh-CN',
  'language.zh-TW',
  'permissionTest.getLocation',
])

const DISPLAY_ATTRIBUTES = new Set(['placeholder', 'title', 'aria-label', 'alt'])

const ELEMENT_NODE = 1
const TEXT_NODE = 2
const ATTRIBUTE_NODE = 6

const LOCALE_MESSAGES = {
  en: messagesIn(en),
  'zh-CN': messagesIn(zhCN),
  'zh-TW': messagesIn(zhTW),
} satisfies Record<(typeof SUPPORTED_LOCALES)[number], LocaleMessages>

const KEYS = messagePaths(LOCALE_MESSAGES.en)
const KEY_SET = new Set(KEYS)
const NAMESPACES = new Set(Object.keys(LOCALE_MESSAGES.en))

const runtimeI18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, 'zh-CN': zhCN, 'zh-TW': zhTW },
})

type ComponentDescriptor = ReturnType<typeof parseComponent>['descriptor']
type TemplateNode = NonNullable<
  NonNullable<ComponentDescriptor['template']>['ast']
>['children'][number]

interface SourceFile {
  readonly path: string
  readonly script: string
  readonly template: string
  readonly descriptor?: ComponentDescriptor
}

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) sourceFiles(path, found)
    else if (/\.(vue|ts)$/.test(path) && !path.endsWith('.test.ts')) found.push(path)
  }
  return found
}

function stripJsComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '')
}

function readSource(path: string): SourceFile {
  const source = readFileSync(path, 'utf8')
  if (!path.endsWith('.vue')) return { path, script: stripJsComments(source), template: '' }

  const { descriptor, errors } = parseComponent(source, { filename: path })
  expect(errors).toEqual([])
  return {
    path,
    descriptor,
    script: stripJsComments(
      [descriptor.script?.content, descriptor.scriptSetup?.content].join('\n'),
    ),
    template: stripHtmlComments(descriptor.template?.content ?? ''),
  }
}

interface KeyUse {
  readonly file: string
  readonly literal?: string
  readonly dynamic?: string
}

/** Every `t()`, `tm()` and `te()` call, with a literal key or its dynamic expression. */
function keyUses(file: SourceFile): KeyUse[] {
  const relativePath = relative(SRC, file.path)
  const text = `${file.script}\n${file.template}`
  const uses: KeyUse[] = []

  for (const match of text.matchAll(/(?<![:\w])keypath=(?:"([^"]+)"|'([^']+)')/g)) {
    uses.push({ file: relativePath, literal: match[1] ?? match[2] })
  }

  for (const match of text.matchAll(/\b(?:t|tm|te)\(/g)) {
    let index = (match.index ?? 0) + match[0].length
    while (/\s/.test(text[index] ?? '')) index += 1
    const quote = text[index]

    if (quote === "'" || quote === '"') {
      let end = index + 1
      while (end < text.length && text[end] !== quote) end += 1
      uses.push({ file: relativePath, literal: text.slice(index + 1, end) })
      continue
    }

    if (quote === '`') {
      let end = index + 1
      while (end < text.length && text[end] !== '`') end += 1
      const template = text.slice(index + 1, end)
      uses.push(
        template.includes('${')
          ? { file: relativePath, dynamic: template }
          : { file: relativePath, literal: template },
      )
      continue
    }

    let end = index
    while (end < text.length && text[end] !== ',' && text[end] !== ')') end += 1
    uses.push({ file: relativePath, dynamic: text.slice(index, end).replace(/\s+/g, ' ').trim() })
  }

  return uses
}

/**
 * Full keys also live in arrays and records that a dynamic `t()` reads later.
 * Anything shaped like a key from a known namespace must name a real message.
 */
function keyLiterals(text: string): string[] {
  return [...text.matchAll(/(['"`])([^'"`\n]+)\1/g)]
    .map((match) => match[2])
    .filter((value) => {
      const separator = value.indexOf('.')
      return separator > 0 && !value.includes('${') && NAMESPACES.has(value.slice(0, separator))
    })
}

function hardcodedTemplateText(node: TemplateNode, file: string, found: string[]): void {
  if (node.type === TEXT_NODE) {
    const text = node.content.replace(/\s+/g, ' ').trim()
    if (/[\p{L}\p{N}]/u.test(text)) found.push(`${file}: text "${text}"`)
  }

  if (node.type === ELEMENT_NODE) {
    for (const prop of node.props) {
      if (prop.type !== ATTRIBUTE_NODE || !DISPLAY_ATTRIBUTES.has(prop.name) || !prop.value)
        continue
      const value = prop.value.content.trim()
      if (/[\p{L}\p{N}]/u.test(value)) found.push(`${file}: ${prop.name}="${value}"`)
    }
    for (const child of node.children) hardcodedTemplateText(child, file, found)
  }
}

interface DynamicUse {
  readonly file: string
  readonly dynamic: string
}

const SOURCES = sourceFiles(SRC).map(readSource)
const USES = SOURCES.flatMap(keyUses)
const STATIC_KEYS = new Set(USES.flatMap((use) => (use.literal ? [use.literal] : [])))
const DYNAMIC_USES: DynamicUse[] = USES.flatMap((use) =>
  use.dynamic ? [{ file: use.file, dynamic: use.dynamic }] : [],
)
const MAPPED_KEYS = new Set(Object.values(DYNAMIC_KEYS).flat())
const LITERAL_KEYS = new Set(SOURCES.flatMap((file) => keyLiterals(file.script)))

describe('locales', () => {
  it('defines every key the source uses', () => {
    expect([...STATIC_KEYS].filter((key) => !KEY_SET.has(key)).sort()).toEqual([])
  })

  it('defines every key-shaped literal in the source', () => {
    expect([...LITERAL_KEYS].filter((key) => !KEY_SET.has(key)).sort()).toEqual([])
  })

  it('maps every dynamic key call site', () => {
    const unmapped = DYNAMIC_USES.filter(
      (use) => !(`${use.file}|${use.dynamic}` in DYNAMIC_KEYS),
    ).map((use) => `${use.file}: ${use.dynamic}`)
    expect(unmapped.sort()).toEqual([])
  })

  it('keeps the dynamic key map in sync with the source', () => {
    const called = new Set(DYNAMIC_USES.map((use) => `${use.file}|${use.dynamic}`))
    expect(
      Object.keys(DYNAMIC_KEYS)
        .filter((call) => !called.has(call))
        .sort(),
    ).toEqual([])
  })

  it('defines every key a dynamic call can produce', () => {
    expect([...MAPPED_KEYS].filter((key) => !KEY_SET.has(key)).sort()).toEqual([])
  })

  it('has no unused keys', () => {
    const used = new Set([...STATIC_KEYS, ...LITERAL_KEYS, ...MAPPED_KEYS])
    expect(KEYS.filter((key) => !used.has(key)).sort()).toEqual([])
  })

  it('covers the same keys in every locale', () => {
    const reference = [...KEYS].sort()
    expect(messagePaths(LOCALE_MESSAGES['zh-CN']).sort()).toEqual(reference)
    expect(messagePaths(LOCALE_MESSAGES['zh-TW']).sort()).toEqual(reference)
  })

  it('keeps placeholders and list lengths aligned across locales', () => {
    const mismatches: string[] = []

    for (const key of KEYS) {
      const reference = messageAt(LOCALE_MESSAGES.en, key)
      for (const locale of SUPPORTED_LOCALES.slice(1)) {
        const value = messageAt(LOCALE_MESSAGES[locale], key)
        if (Array.isArray(reference) || Array.isArray(value)) {
          if (
            !Array.isArray(reference) ||
            !Array.isArray(value) ||
            reference.length !== value.length
          ) {
            mismatches.push(`${locale}: ${key}`)
          }
          continue
        }
        if (holes(reference) !== holes(value)) mismatches.push(`${locale}: ${key}`)
      }
    }

    expect(mismatches.sort()).toEqual([])
  })

  it('leaves no value untranslated', () => {
    const untranslated: string[] = []
    for (const key of KEYS) {
      if (SAME_ACROSS_LOCALES.has(key)) continue
      const reference = messageAt(LOCALE_MESSAGES.en, key)
      for (const locale of SUPPORTED_LOCALES.slice(1)) {
        const value = messageAt(LOCALE_MESSAGES[locale], key)
        if (Array.isArray(reference) || Array.isArray(value)) {
          if (
            Array.isArray(reference) &&
            Array.isArray(value) &&
            value.some((item, index) => item === reference[index])
          ) {
            untranslated.push(`${locale}: ${key}`)
          }
          continue
        }
        if (value === reference) untranslated.push(`${locale}: ${key}`)
      }
    }
    expect(untranslated.sort()).toEqual([])
  })

  it('has no empty messages', () => {
    const empty: string[] = []
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of KEYS) {
        const value = messageAt(LOCALE_MESSAGES[locale], key)
        if (Array.isArray(value)) {
          if (value.length === 0 || value.some((item) => !item.trim()))
            empty.push(`${locale}: ${key}`)
        } else if (!value?.trim()) empty.push(`${locale}: ${key}`)
      }
    }
    expect(empty.sort()).toEqual([])
  })

  it('resolves every key in every locale at runtime', () => {
    const failures: string[] = []
    for (const locale of SUPPORTED_LOCALES) {
      runtimeI18n.global.locale.value = locale
      for (const key of KEYS) {
        if (Array.isArray(messageAt(LOCALE_MESSAGES.en, key))) continue
        const value = runtimeI18n.global.t(key)
        if (!value.trim() || value === key) failures.push(`${locale}: ${key}`)
      }
    }
    runtimeI18n.global.locale.value = 'en'
    expect(failures.sort()).toEqual([])
  })

  it('writes no user-facing text into a template', () => {
    const hardcoded = SOURCES.flatMap((file) => {
      const found: string[] = []
      for (const node of file.descriptor?.template?.ast?.children ?? []) {
        hardcodedTemplateText(node, relative(SRC, file.path), found)
      }
      return found
    })
    expect(hardcoded.sort()).toEqual([])
  })

  it('writes no CJK into a script or template', () => {
    const literals = SOURCES.flatMap((file) => {
      const text = `${file.script}\n${file.template}`
      return [...text.matchAll(/(['"`])([^'"`\n]*[一-鿿][^'"`\n]*)\1/g)].map(
        (match) => `${relative(SRC, file.path)}: ${match[2]}`,
      )
    })
    expect(literals.sort()).toEqual([])
  })
})

function holes(message: string | string[] | undefined): string {
  if (message === undefined || Array.isArray(message)) return ''
  return [...message.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',')
}
