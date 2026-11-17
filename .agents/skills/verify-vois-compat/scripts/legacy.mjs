import { spawn } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureBrowserFor } from './resolve.mjs'
import { runSweep, writeResults } from './sweep.mjs'

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url)).replace(/\/$/, '')
const DIST_DIR = join(REPO_ROOT, 'apps/website/dist')
const PREVIEW_PORT = 8081
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`
const MINIMUM_TARGET = 64
const vpBin = process.env.VP_BIN ?? 'vp'

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

function exited(child) {
  return child.exitCode !== null || child.signalCode !== null
}

function option(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback
}

function run(command, args, options = {}) {
  return new Promise((settle, fail) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.on('error', fail)
    child.on('exit', (code, signal) => {
      if (code === 0) settle()
      else fail(new Error(`${command} ${args.join(' ')} exited with ${code ?? signal}`))
    })
  })
}

async function debugStatus(base = PREVIEW_URL) {
  try {
    const response = await fetch(`${base}/__debug/status`, {
      signal: AbortSignal.timeout(1500),
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function logTail(path, lines = 20) {
  try {
    return readFileSync(path, 'utf8').trim().split('\n').slice(-lines).join('\n')
  } catch {
    return ''
  }
}

async function stopPreview(child) {
  if (!child || exited(child)) return
  try {
    // The preview runs its own process group, so a wrapper exit leaves no port 8081 behind.
    process.kill(-child.pid, 'SIGTERM')
  } catch {}
  await sleep(1500)
  if (!exited(child)) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {}
  }
}

function startPreview(logPath) {
  const logFd = openSync(logPath, 'w')
  const child = spawn(vpBin, ['preview', '--host', '--port', String(PREVIEW_PORT), '--debug'], {
    cwd: join(REPO_ROOT, 'apps/website'),
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: process.env,
  })
  closeSync(logFd)
  child.unref()
  return child
}

async function waitForPreview(child, logPath, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (exited(child)) {
      const tail = logTail(logPath)
      throw new Error(
        `preview exited with ${child.exitCode ?? child.signalCode ?? 'unknown'}${tail ? `\n${tail}` : ''}\n` +
          `another process may own port ${PREVIEW_PORT}; stop the preview you started earlier`,
      )
    }
    const status = await debugStatus()
    if (status) return status
    await sleep(500)
  }
  throw new Error(
    `debug preview on ${PREVIEW_URL} did not answer in ${timeoutMs}ms\n${logTail(logPath)}`,
  )
}

function entryScripts(distDir) {
  const htmlPath = join(distDir, 'index.html')
  if (!existsSync(htmlPath)) throw new Error(`no built index.html at ${htmlPath}`)
  const html = readFileSync(htmlPath, 'utf8')
  const sources = [...html.matchAll(/<script\b[^>]*\b(?:data-)?src="([^"]+\.js)"/g)].map(
    (match) => match[1],
  )
  return [...new Set(sources)].map((source) => join(distDir, source.replace(/^\.?\//, '')))
}

/** Vite+ leaves JS syntax alone, so the build plugin's output is the thing to check. */
function checkEntrySyntax(distDir) {
  const files = entryScripts(distDir).map((file) => {
    const code = readFileSync(file, 'utf8')
    return {
      file: file.slice(distDir.length + 1),
      nullish: (code.match(/\?\?/g) ?? []).length,
      // `x ?.25 : 0` is a ternary with a decimal, not optional chaining.
      optionalChaining: (code.match(/\?\.(?!\d)/g) ?? []).length,
    }
  })
  const total = files.reduce(
    (sum, file) => ({
      nullish: sum.nullish + file.nullish,
      optionalChaining: sum.optionalChaining + file.optionalChaining,
    }),
    { nullish: 0, optionalChaining: 0 },
  )
  return { files, total, pass: total.nullish === 0 && total.optionalChaining === 0 }
}

// Vite Task's fspy tracer is arm64-only; the Chromium snapshots are x86_64.
// Fail with the fix instead of a dyld wall.
if (process.arch === 'arm64' && process.env.FSPY === '1') {
  console.error(
    'Vite Task file tracing (FSPY) is active and cannot load into the x86_64 Chromium snapshot.\n' +
      'Re-run with: vp run --no-cache verify:legacy',
  )
  process.exit(2)
}

const argv = process.argv.slice(2)
const target = Number(option(argv, 'target', '70'))
const skipBuild = argv.includes('--skip-build')
const reusePreview = argv.includes('--reuse-preview')
const waitMs = Number(option(argv, 'wait', process.env.WAIT_MS ?? '30000'))

if (!Number.isInteger(target) || target < MINIMUM_TARGET) {
  console.error(
    `Chrome ${target} is below the measured floor (${MINIMUM_TARGET}). ` +
      "The 63 attempt is known-blocked by the legacy polyfills' \\p{Emoji} regex, " +
      'so it is not a supported sweep target.',
  )
  process.exit(2)
}

const outRoot = resolve(
  option(argv, 'out-root', join(REPO_ROOT, 'apps/website/.tmp/verify/compat/legacy')),
)
const outDir = join(outRoot, String(target))
const previewLog = join(outDir, 'preview.log')
const startedAt = new Date().toISOString()
mkdirSync(outDir, { recursive: true })

let previewChild
let exitCode = 0
try {
  if (!skipBuild) {
    console.log(`building apps/website for chrome ${target}`)
    // A cached build can replay across targets; the sweep must build the target it names.
    await run(vpBin, ['run', '--no-cache', 'website#build'], {
      cwd: REPO_ROOT,
      env: { ...process.env, VOIS_CHROME_TARGET: `chrome ${target}` },
    })
  }

  const syntaxCheck = checkEntrySyntax(DIST_DIR)
  console.log(
    `entry syntax: ${syntaxCheck.pass ? 'PASS' : 'FAIL'} ` +
      `nullish ${syntaxCheck.total.nullish}, optional chaining ${syntaxCheck.total.optionalChaining}`,
  )
  for (const file of syntaxCheck.files) {
    console.log(
      `  ${file.file}: nullish ${file.nullish}, optional chaining ${file.optionalChaining}`,
    )
  }
  if (!syntaxCheck.pass) {
    throw new Error(`entry chunks still contain syntax Chrome ${target} cannot parse`)
  }

  const browser = await ensureBrowserFor(target)
  console.log(`chromium ${browser.binaryVersion} ${browser.cached ? '(cached)' : '(downloaded)'}`)

  let previewStatus = await debugStatus()
  const reused = previewStatus !== null
  if (!reused) {
    if (reusePreview) {
      throw new Error(`no debug preview is answering on ${PREVIEW_URL}`)
    }
    previewChild = startPreview(previewLog)
    previewStatus = await waitForPreview(previewChild, previewLog)
  }
  console.log(`debug preview ${reused ? 'reused' : 'started'}: ${PREVIEW_URL}`)

  const row = await runSweep({
    major: target,
    appUrl: `${PREVIEW_URL}/?capture=bridge#/devices`,
    outDir,
    waitMs,
    browser,
  })
  const resultsPath = writeResults(outDir, [row])

  writeFileSync(
    join(outDir, 'run.json'),
    `${JSON.stringify(
      {
        layer: 'legacy',
        target,
        chromeTarget: `chrome ${target}`,
        appUrl: `${PREVIEW_URL}/?capture=bridge#/devices`,
        built: !skipBuild,
        preview: {
          url: PREVIEW_URL,
          reused,
          sessionStartedAt: previewStatus?.sessionStartedAt ?? null,
        },
        syntaxCheck,
        capture: {
          mode: 'bridge',
          eventsPath: 'apps/website/.tmp/vois-webview-debug/events.jsonl',
          bridgeCount: row.bridge?.count ?? 0,
          bridgeSummary: row.bridge?.summary ?? {},
        },
        browser: {
          version: browser.binaryVersion,
          cached: browser.cached,
          snapshot: browser.snapshotRevision,
        },
        startedAt,
        finishedAt: new Date().toISOString(),
        result: {
          pass: row.pass,
          classification: row.classification,
          checks: row.checks,
          waitedMs: row.waitedMs,
          bridge: row.bridge?.summary ?? {},
          notes: row.notes,
        },
      },
      null,
      2,
    )}\n`,
  )

  console.log(`legacy chrome ${target}: ${row.pass ? 'PASS' : 'FAIL'} ${row.classification}`)
  console.log(`screenshot: ${row.screenshot}`)
  console.log(`results: ${resultsPath.slice(REPO_ROOT.length + 1)}`)
  if (row.notes) console.log(`notes: ${row.notes}`)
  if (!row.pass) exitCode = 1
} catch (error) {
  console.error(`legacy chrome ${target}: ERROR ${error.message}`)
  exitCode = 1
} finally {
  await stopPreview(previewChild)
}

process.exitCode = exitCode
