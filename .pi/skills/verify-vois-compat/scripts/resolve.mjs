import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The same machine-local cache the stand-alone chrome-sweep tool uses, so a
 * browser downloaded by either one is reused instead of fetched again.
 */
export const SWEEP_ROOT =
  process.env.CHROME_SWEEP_ROOT ?? join(homedir(), '.vois', 'tools', 'chrome-sweep')
export const BROWSERS = join(SWEEP_ROOT, 'browsers')

const SNAPSHOT_ROOT = 'https://commondatastorage.googleapis.com/chromium-browser-snapshots/Mac'

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

async function get(url, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${response.status} ${url}`)
      return response
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(attempt * 1000)
    }
  }
  throw lastError
}

async function getJson(url) {
  return (await get(url)).json()
}

async function getGooglesourceCommit(hash) {
  const text = await (
    await get(`https://chromium.googlesource.com/chromium/src/+/${hash}?format=JSON`)
  ).text()
  return JSON.parse(text.slice(text.indexOf('\n') + 1))
}

export async function resolveMilestone(major) {
  const releases = await getJson(
    `https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Mac&milestone=${major}`,
  )
  const release = releases[0]
  if (!release) throw new Error(`no Stable Mac release for milestone ${major}`)

  const chromiumHash = release.hashes.chromium
  const publishCommit = await getGooglesourceCommit(chromiumHash)
  const incrementCommit = await getGooglesourceCommit(publishCommit.parents[0])
  const branchedFrom = incrementCommit.message.match(/Cr-Branched-From:[^\n]*?@\{#(\d+)\}/)
  if (!branchedFrom) throw new Error(`no Cr-Branched-From in ${incrementCommit.commit}`)
  const branchRevision = Number(branchedFrom[1])

  const { revision: snapshotRevision } = await findSnapshot(branchRevision)
  const zipStatus = await fetch(`${SNAPSHOT_ROOT}/${snapshotRevision}/chrome-mac.zip`, {
    method: 'HEAD',
  })
  if (zipStatus.status !== 200) {
    throw new Error(`snapshot ${snapshotRevision} zip returned ${zipStatus.status}`)
  }

  return {
    requestedMajor: major,
    chromiumDashVersion: release.version,
    chromiumHash,
    branchRevision,
    snapshotRevision,
  }
}

async function findSnapshot(branchRevision) {
  const branchText = String(branchRevision)
  for (const prefixLength of [6, 5, 4]) {
    if (branchText.length < prefixLength) continue
    const prefix = branchText.slice(0, prefixLength)
    const listing = await getJson(
      `https://storage.googleapis.com/storage/v1/b/chromium-browser-snapshots/o?prefix=Mac/${prefix}&delimiter=/&maxResults=1000`,
    )
    const candidates = (listing.prefixes ?? [])
      .map((entry) => Number(entry.split('/')[1]))
      .filter((revision) => Number.isFinite(revision))
      .filter((revision) => String(revision).length === branchText.length)
      .filter((revision) => revision <= branchRevision)
      .sort((left, right) => left - right)
    if (candidates.length > 0) return { revision: candidates.at(-1), prefix }
  }
  throw new Error(`no Mac snapshot at or below r${branchRevision}`)
}

export function browserPaths(major) {
  const root = join(BROWSERS, String(major))
  const app = join(root, 'chrome-mac', 'Chromium.app')
  return {
    root,
    app,
    binary: join(app, 'Contents', 'MacOS', 'Chromium'),
    zip: join(root, 'chrome-mac.zip'),
  }
}

export function binaryVersion(binary) {
  let output
  try {
    // Chromium 70 and 64 snapshots are x64; the host may be arm64.
    output = execFileSync('arch', ['-x86_64', binary, '--version'], { encoding: 'utf8' })
  } catch {
    output = execFileSync(binary, ['--version'], { encoding: 'utf8' })
  }
  const match = output.trim().match(/Chromium\s+(\d+\.\d+\.\d+\.\d+)/)
  if (!match) throw new Error(`unrecognized version output: ${output}`)
  return match[1]
}

export async function ensureBrowser(resolved) {
  const { requestedMajor, snapshotRevision } = resolved
  const paths = browserPaths(requestedMajor)

  if (existsSync(paths.binary)) {
    try {
      const version = binaryVersion(paths.binary)
      if (version.startsWith(`${requestedMajor}.`)) {
        return { ...resolved, binary: paths.binary, binaryVersion: version, cached: true }
      }
    } catch {}
  }

  mkdirSync(paths.root, { recursive: true })
  rmSync(paths.zip, { force: true })
  const response = await get(`${SNAPSHOT_ROOT}/${snapshotRevision}/chrome-mac.zip`, 3)
  writeFileSync(paths.zip, Buffer.from(await response.arrayBuffer()))
  execFileSync('unzip', ['-q', '-o', paths.zip, '-d', paths.root], { stdio: 'inherit' })
  try {
    execFileSync('xattr', ['-d', 'com.apple.quarantine', paths.app], { stdio: 'ignore' })
  } catch {}

  if (!existsSync(paths.binary)) throw new Error(`extraction produced no binary at ${paths.binary}`)
  const version = binaryVersion(paths.binary)
  if (!version.startsWith(`${requestedMajor}.`)) {
    throw new Error(`snapshot r${snapshotRevision} reports ${version}`)
  }
  return { ...resolved, binary: paths.binary, binaryVersion: version, cached: false }
}

/** Reuse the cached browser without touching the network; download only on a miss. */
export async function ensureBrowserFor(major) {
  const paths = browserPaths(major)
  if (existsSync(paths.binary)) {
    try {
      const version = binaryVersion(paths.binary)
      if (version.startsWith(`${major}.`)) {
        return {
          requestedMajor: major,
          binary: paths.binary,
          binaryVersion: version,
          snapshotRevision: null,
          cached: true,
        }
      }
    } catch {}
  }
  return ensureBrowser(await resolveMilestone(major))
}

export function parseMilestones(argv = process.argv.slice(2), fallback = '70') {
  const index = argv.indexOf('--milestones')
  const raw = index >= 0 ? argv[index + 1] : (process.env.MILESTONES ?? fallback)
  if (!raw) throw new Error('no milestones given')
  const majors = raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
  if (majors.length === 0) throw new Error(`invalid milestones: ${raw}`)
  return majors
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const resolved = []
  for (const major of parseMilestones()) {
    try {
      resolved.push(await ensureBrowserFor(major))
    } catch (error) {
      resolved.push({ requestedMajor: major, error: String(error) })
    }
  }
  console.log(JSON.stringify(resolved, null, 2))
}
