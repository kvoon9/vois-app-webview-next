#!/usr/bin/env node
/**
 * Release notes for vois-app-webview-next, derived from git commits.
 *
 * Why not changelogen: its markdown does not survive as a QQ message: headings,
 * emoji, links, contributor list and English section names all read badly in a
 * chat bubble, and QQ drops whitespace-only lines entirely. The message shape is
 * fixed in ../references/message-format.md; change that file first.
 *
 * CLI:
 *   node changelog.mjs --print            # draft body for the newest tag
 *   node changelog.mjs --print-message    # the whole message (title line + body)
 *   node changelog.mjs --json             # raw commits, for an agent to rewrite in Chinese
 *   node changelog.mjs --to v0.11.0 --from v0.10.1 [--max-items 6]
 */
import { execFileSync } from 'node:child_process'

/**
 * Section order and Chinese titles. `types` are conventional-commit types; the
 * first matching section wins, `breaking` wins over everything.
 */
export const SECTIONS = [
  { key: 'breaking', title: '不兼容变更', types: [] },
  { key: 'feat', title: '新增', types: ['feat', 'feature'] },
  { key: 'fix', title: '修复', types: ['fix', 'bugfix', 'hotfix'] },
  { key: 'perf', title: '优化', types: ['perf', 'performance'] },
  { key: 'refactor', title: '重构', types: ['refactor'] },
  { key: 'docs', title: '文档', types: ['docs', 'doc'] },
  { key: 'build', title: '构建', types: ['build', 'ci'] },
  { key: 'other', title: '其他', types: ['chore', 'test', 'style', 'revert', 'other'] },
]

/** Sections that are noise in a chat notification unless they carry real news. */
export const QUIET_SECTIONS = new Set(['other'])

const CONVENTIONAL = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?:\s*(?<subject>.+)$/i
const NOISE = [/^release v?\d/i, /^v?\d+\.\d+\.\d+$/, /^update$/i, /^wip\b/i]

export function git(args, { cwd = process.cwd(), allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    if (allowFail) return null
    throw error
  }
}

export function latestTag(ref = 'HEAD', cwd) {
  return git(['describe', '--tags', '--abbrev=0', ref], { cwd, allowFail: true })
}

export function previousTag(tag, cwd) {
  if (!tag) return null
  return git(['describe', '--tags', '--abbrev=0', `${tag}^`], { cwd, allowFail: true })
}

/** Commits in `from..to` (or everything reachable from `to`), conventional-commit parsed. */
export function commitsInRange({ from, to = 'HEAD', cwd = process.cwd() } = {}) {
  const range = from ? `${from}..${to}` : to
  const raw = git(['log', '--no-merges', '--pretty=format:%h%x1f%s%x1e', range], { cwd })
  if (!raw) return []
  return raw
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter(Boolean)
    .map((record) => {
      const [hash, subject = ''] = record.split('\x1f')
      const parsed = subject.match(CONVENTIONAL)
      return {
        hash: hash?.trim(),
        subject: subject.trim(),
        type: (parsed?.groups?.type || 'other').toLowerCase(),
        scope: parsed?.groups?.scope?.trim() || '',
        breaking: Boolean(parsed?.groups?.breaking),
        text: (parsed?.groups?.subject || subject).trim(),
      }
    })
    .filter((commit) => commit.hash && !NOISE.some((re) => re.test(commit.text)))
}

function sectionKeyOf(commit) {
  if (commit.breaking) return 'breaking'
  const match = SECTIONS.find((section) => section.types.includes(commit.type))
  return match ? match.key : 'other'
}

/** Group commits into the fixed sections, newest first inside each section. */
export function groupCommits(commits, { maxItems = 6 } = {}) {
  const groups = []
  for (const section of SECTIONS) {
    const items = []
    let overflow = 0
    for (const commit of commits) {
      if (sectionKeyOf(commit) !== section.key) continue
      if (items.length < maxItems) items.push(commit)
      else overflow += 1
    }
    if (items.length) groups.push({ ...section, items, overflow })
  }
  return groups
}

const trim = (text, width = 26) => (text.length > width ? `${text.slice(0, width - 1)}…` : text)

/**
 * Draft body in the fixed format: `本次更新 N 项（from → to）` then one line per
 * section. Commit subjects stay as authored here; an agent rewrites them into
 * Chinese before sending (see references/message-format.md).
 */
export function draftBody({ tag, from, commits, groups, maxSections = 5 }) {
  const head = from
    ? `本次更新 ${commits.length} 项（${from} → ${tag}）`
    : `本次更新 ${commits.length} 项`
  if (!commits.length) return `${head}\n本次没有面向用户的变化`
  const lines = groups.slice(0, maxSections).map((group) => {
    const parts = group.items.map((commit) =>
      commit.scope ? `${commit.scope}：${trim(commit.text)}` : trim(commit.text),
    )
    if (group.overflow) parts.push(`等 ${group.overflow} 项`)
    return `${group.title}：${parts.join('；')}`
  })
  return [head, ...lines].join('\n')
}

/** Last line of every notification, fixed in references/message-format.md. */
export const CALL_TO_ACTION = '有空可更新一下 @大宝'

/** Title line + body + call to action. No blank lines: QQ drops whitespace-only lines. */
export function buildMessage({
  url,
  body,
  title = 'vois-app-webview-next 已更新',
  callToAction = CALL_TO_ACTION,
}) {
  return [`${title}：${url}`, (body || '').trim(), callToAction].filter(Boolean).join('\n')
}

export function releaseNotes({ tag, cwd = process.cwd(), maxItems = 6 } = {}) {
  const from = previousTag(tag, cwd)
  const commits = commitsInRange({ from, to: tag, cwd })
  const groups = groupCommits(commits, { maxItems })
  return { tag, from, commits, groups, body: draftBody({ tag, from, commits, groups }) }
}

/* ------------------------------------------------------------------ cli */
function main() {
  const argv = process.argv.slice(2)
  const arg = (name, fallback) => {
    const i = argv.indexOf(`--${name}`)
    return i === -1 ? fallback : argv[i + 1]
  }
  const tag = arg('to') || latestTag() || 'HEAD'
  const notes = releaseNotes({ tag, maxItems: Number(arg('max-items', 6)) })
  if (arg('from')) {
    notes.from = arg('from')
    notes.commits = commitsInRange({ from: notes.from, to: tag })
    notes.groups = groupCommits(notes.commits, { maxItems: Number(arg('max-items', 6)) })
    notes.body = draftBody({ tag, from: notes.from, commits: notes.commits, groups: notes.groups })
  }

  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(notes, null, 2)}\n`)
    return
  }
  const url =
    arg('url') ||
    `https://github.com/${arg('repo') || 'kvoon9/vois-app-webview-next'}/releases/tag/${tag}`
  process.stdout.write(
    `${argv.includes('--print-message') ? buildMessage({ url, body: notes.body }) : notes.body}\n`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main()
  } catch (error) {
    console.error(`changelog: ${error.message}`)
    process.exit(1)
  }
}
