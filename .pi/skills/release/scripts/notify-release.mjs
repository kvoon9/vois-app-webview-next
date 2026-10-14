#!/usr/bin/env node
/**
 * Send the release notification for one tag to QQ.
 *
 * Message shape (fixed in ../references/message-format.md):
 *   vois-app-webview-next 已更新：<release url>
 *   本次更新 N 项（<prev> → <tag>）
 *   新增：…
 *   修复：…
 *
 * The body is either the commit-derived draft or, preferably, the Chinese
 * rewrite an agent passes with --notes-file. Delivery uses the local macOS QQ
 * driver in scripts/qq (Accessibility API; see ../references/qqctl.md).
 *
 * Usage:
 *   node notify-release.mjs --tag v0.11.0 [--notes-file /tmp/notes.txt] [--to 我的手机]
 *   node notify-release.mjs --tag v0.11.0 --dry-run
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { buildMessage, latestTag, releaseNotes } from './changelog.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const QQCTL = path.join(here, 'qq', 'qqctl')

function sh(cmd, args, { cwd = process.cwd(), allowFail = false } = {}) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    if (allowFail) return null
    throw new Error(`${cmd} ${args.join(' ')} failed: ${error.stderr || error.message}`)
  }
}

export function resolveRepo({ cwd = process.cwd() } = {}) {
  const fromGh = sh('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], {
    cwd,
    allowFail: true,
  })
  if (fromGh) return fromGh
  const remote = sh('git', ['remote', 'get-url', 'origin'], { cwd, allowFail: true }) || ''
  const match = remote.match(/github\.com[:/]([^/]+\/[^/.]+)/)
  return match ? match[1] : null
}

/** The release page URL: authoritative from gh once the release exists. */
export function releaseUrl(tag, { repo, url, cwd = process.cwd() } = {}) {
  if (url) return url
  const fromGh = sh('gh', ['release', 'view', tag, '--json', 'url', '-q', '.url'], {
    cwd,
    allowFail: true,
  })
  if (fromGh) return fromGh
  if (!repo) throw new Error('cannot determine the release URL; pass --url or --repo')
  return `https://github.com/${repo}/releases/tag/${tag}`
}

/**
 * Compose the message. `notesFile` (or `notes`) wins over the commit draft so an
 * agent can send the Chinese rewrite the format asks for.
 */
export function compose({
  tag,
  repo,
  url,
  notes,
  notesFile,
  maxItems = 6,
  cwd = process.cwd(),
} = {}) {
  const resolvedUrl = releaseUrl(tag, { repo, url, cwd })
  let body
  let source
  if (notesFile) {
    body = fs.readFileSync(notesFile, 'utf8')
    source = notesFile
  } else if (notes) {
    body = notes
    source = '--notes'
  } else {
    const draft = releaseNotes({ tag, cwd, maxItems })
    body = draft.body
    source = 'commit draft'
  }
  return {
    tag,
    url: resolvedUrl,
    body: body.trim(),
    source,
    message: buildMessage({ url: resolvedUrl, body }),
  }
}

export function deliver(message, { to = '我的手机', dryRun = false } = {}) {
  if (dryRun) return { ok: true, dryRun: true }
  const result = spawnSync(QQCTL, ['send', to, message], { encoding: 'utf8' })
  if (result.error) throw result.error
  let payload
  try {
    payload = JSON.parse((result.stdout || '').trim())
  } catch {
    payload = {
      ok: result.status === 0,
      raw: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim(),
    }
  }
  if (result.status !== 0 || payload?.ok === false)
    throw new Error(`QQ delivery failed (exit ${result.status}): ${JSON.stringify(payload)}`)
  return payload
}

function main() {
  const { values } = parseArgs({
    options: {
      tag: { type: 'string' },
      to: { type: 'string', default: '我的手机' },
      repo: { type: 'string' },
      url: { type: 'string' },
      notes: { type: 'string' },
      'notes-file': { type: 'string' },
      'max-items': { type: 'string', default: '6' },
      'dry-run': { type: 'boolean', default: false },
    },
  })
  const tag = values.tag || latestTag()
  if (!tag) throw new Error('no tag found; pass --tag vX.Y.Z')
  const payload = compose({
    tag,
    repo: values.repo || resolveRepo(),
    url: values.url,
    notes: values.notes,
    notesFile: values['notes-file'],
    maxItems: Number(values['max-items']),
  })
  const delivery = deliver(payload.message, { to: values.to, dryRun: values['dry-run'] })
  if (values['dry-run']) process.stdout.write(`${payload.message}\n`)
  else
    process.stdout.write(
      `${JSON.stringify({ ok: true, tag, url: payload.url, source: payload.source, to: values.to, delivery }, null, 2)}\n`,
    )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main()
  } catch (error) {
    console.error(`notify-release: ${error.message}`)
    process.exit(1)
  }
}
