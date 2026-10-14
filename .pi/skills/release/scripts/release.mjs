#!/usr/bin/env node
/**
 * Release vois-app-webview-next in one command.
 *
 *   bump (bumpp) -> commit + tag + push -> Release workflow (tag push)
 *                -> wait for the GitHub Release -> QQ notification
 *
 * Usage:
 *   node .pi/skills/release/scripts/release.mjs --type minor
 *   node .pi/skills/release/scripts/release.mjs --type patch --dry-run
 *   node .pi/skills/release/scripts/release.mjs --skip-bump --skip-watch   # only notify
 *
 * The QQ notification is the last step and never blocks a released version:
 * if it fails the release itself is already out, and the script exits non-zero
 * so the failure is visible.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { git, latestTag, previousTag } from './changelog.mjs'
import { compose, deliver } from './notify-release.mjs'

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const WORKFLOW = 'release.yml'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const log = (step, message) => console.log(`\u001B[36m[${step}]\u001B[0m ${message}`)
const warn = (message) => console.warn(`\u001B[33m[warn]\u001B[0m ${message}`)

function run(cmd, args, { allowFail = false, quiet = false } = {}) {
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    if (allowFail) return { ok: false, stdout: result.stdout || '', stderr: result.stderr || '' }
    throw new Error(`${cmd} ${args.join(' ')} exited with ${result.status}`)
  }
  return { ok: true, stdout: result.stdout || '' }
}

function gh(args, opts) {
  return run('gh', args, { quiet: true, ...opts })
}

function preflight({ allowDirty }) {
  const dirty = git(['status', '--porcelain'])
  if (dirty && !allowDirty)
    throw new Error(
      `working tree is not clean:\n${dirty}\nCommit or stash first, or pass --allow-dirty`,
    )
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  if (branch !== 'main') warn(`on branch ${branch}; releases are usually tagged from main`)
  const fetch = run('git', ['fetch', '--tags', '--quiet', 'origin'], {
    allowFail: true,
    quiet: true,
  })
  if (!fetch.ok) warn('git fetch --tags failed (offline?); tag list may be stale')
  return { branch }
}

/** bumpp --recursive bumps every workspace package, commits, tags and pushes. */
function bump({ type, push, yes }) {
  const before = latestTag() || 'none'
  const args = ['exec', 'bumpp', '--recursive', '--release', type]
  if (yes) args.push('--yes')
  if (!push) args.push('--no-push')
  log('bump', `pnpm ${args.join(' ')}   (current tag: ${before})`)
  run('pnpm', args)
  const tag = latestTag()
  if (!tag || tag === before) throw new Error('bumpp finished but no new tag was created')
  return { tag, previous: before }
}

async function findRun(tag, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = gh([
      'run',
      'list',
      '--workflow',
      WORKFLOW,
      '--limit',
      '20',
      '--json',
      'databaseId,headBranch,status,conclusion,url,createdAt',
    ])
    if (result.ok) {
      try {
        const runs = JSON.parse(result.stdout)
        const match = runs.find((run) => run.headBranch === tag)
        if (match) return match
      } catch {
        /* keep polling */
      }
    }
    await sleep(5000)
  }
  return null
}

async function waitForRelease(tag, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    const result = gh(['release', 'view', tag, '--json', 'url,assets,publishedAt,isDraft'])
    if (result.ok) {
      try {
        last = JSON.parse(result.stdout)
        if (!last.isDraft && last.assets?.length) return last
      } catch {
        /* keep polling */
      }
    }
    await sleep(5000)
  }
  return last
}

async function watch({ tag, timeoutMs }) {
  log('watch', `waiting for the ${WORKFLOW} run of ${tag}`)
  const runInfo = await findRun(tag, 120_000)
  if (!runInfo) {
    warn(`no ${WORKFLOW} run appeared for ${tag} within 2 min; polling the release instead`)
  } else {
    log('watch', `run ${runInfo.databaseId}: ${runInfo.url}`)
    const watched = spawnSync('gh', ['run', 'watch', String(runInfo.databaseId), '--exit-status'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    })
    if (watched.status !== 0) {
      const view = gh(['run', 'view', String(runInfo.databaseId), '--json', 'conclusion,url'])
      throw new Error(
        `release workflow failed (${view.stdout?.trim() || 'unknown'}). Inspect: gh run view ${runInfo.databaseId} --log-failed`,
      )
    }
    log('watch', 'workflow finished successfully')
  }
  const release = await waitForRelease(tag, timeoutMs)
  if (!release?.url) throw new Error(`GitHub release ${tag} did not appear within the wait window`)
  log(
    'release',
    `${release.url}  assets: ${(release.assets || []).map((a) => a.name).join(', ') || 'none'}`,
  )
  return release
}

async function main() {
  const { values } = parseArgs({
    options: {
      type: { type: 'string', default: 'patch' },
      to: { type: 'string', default: '我的手机' },
      repo: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'skip-bump': { type: 'boolean', default: false },
      'skip-watch': { type: 'boolean', default: false },
      'skip-notify': { type: 'boolean', default: false },
      'allow-dirty': { type: 'boolean', default: false },
      'no-push': { type: 'boolean', default: false },
      'watch-timeout': { type: 'string', default: '300' },
      'notes-file': { type: 'string' },
      'max-items': { type: 'string', default: '6' },
      yes: { type: 'boolean', default: true },
    },
  })
  const timeoutMs = Number(values['watch-timeout']) * 1000
  const plan = {
    bump: !values['skip-bump'],
    watch: !values['skip-watch'] && !values['no-push'],
    notify: !values['skip-notify'],
    type: values.type,
    to: values.to,
    dryRun: values['dry-run'],
  }

  if (values['dry-run']) {
    const current = latestTag()
    log('plan', JSON.stringify({ ...plan, currentTag: current }, null, 2))
    log('plan', 'dry run: nothing is bumped, pushed or sent')
    return
  }

  preflight({ allowDirty: values['allow-dirty'] })

  let tag = latestTag()
  let previous = previousTag(tag)
  if (plan.bump) {
    const bumped = bump({ type: values.type, push: !values['no-push'], yes: values.yes })
    tag = bumped.tag
    previous = bumped.previous
  }
  if (!tag) throw new Error('no tag to watch or notify about')
  log('tag', `${previous || '(first release)'} -> ${tag}`)

  let release = null
  if (plan.watch) release = await watch({ tag, timeoutMs })
  else log('watch', 'skipped')

  if (plan.notify) {
    const payload = compose({
      tag,
      repo: values.repo,
      notesFile: values['notes-file'],
      maxItems: Number(values['max-items']),
    })
    log('notify', `-> QQ 会话「${values.to}」（正文来源：${payload.source}）`)
    const delivery = deliver(payload.message, { to: values.to })
    log('notify', `delivered: ${JSON.stringify(delivery?.steps ?? delivery)}`)
    console.log(`\n${payload.message}\n`)
  } else {
    log('notify', 'skipped')
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        tag,
        previous,
        release: release?.url ?? null,
        notified: plan.notify,
        to: values.to,
      },
      null,
      2,
    ),
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`\nrelease: ${error.message}`)
    process.exit(1)
  })
}
