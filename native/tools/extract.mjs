#!/usr/bin/env node
// Verify a vendored App package against native/index.json and extract it for analysis.
// Output lands in .tmp/rev/<artifactId>/ and is never committed; see native/README.md.

import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const indexPath = path.join(repoRoot, 'native/index.json')
const workRoot = path.join(repoRoot, '.tmp/rev')

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(1)
}

async function sha256(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

async function exists(file) {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const positional = argv.filter((a) => !a.startsWith('--'))
for (const flag of flags) {
  if (!['--verify-only', '--force', '--help'].includes(flag)) fail(`unknown flag ${flag}`)
}
if (flags.has('--help')) {
  console.log(
    'usage: node native/tools/extract.mjs [<artifactId|packagePath>] [--verify-only] [--force]',
  )
  process.exit(0)
}

const index = JSON.parse(await readFile(indexPath, 'utf8'))
const artifacts = index.artifacts ?? []
const wanted = positional[0]

let artifact
if (wanted) {
  artifact = artifacts.find(
    (a) =>
      a.id === wanted ||
      a.package?.filename === wanted ||
      a.package?.vendoredPath === wanted ||
      a.package?.vendoredPath?.endsWith(`/${wanted}`),
  )
  if (!artifact) fail(`no artifact in native/index.json matches ${wanted}`)
} else if (artifacts.length === 1) {
  ;[artifact] = artifacts
} else {
  fail(`multiple artifacts; pass one of: ${artifacts.map((a) => a.id).join(', ')}`)
}

const packagePath = path.join(repoRoot, artifact.package.vendoredPath)
if (!(await exists(packagePath)))
  fail(`package missing: ${artifact.package.vendoredPath} (keep vendored packages untracked)`)

const { size } = await stat(packagePath)
if (size !== artifact.package.size) {
  console.warn(`warning: size ${size} differs from index ${artifact.package.size}`)
}

const digest = await sha256(packagePath)
if (digest !== artifact.package.sha256) {
  fail(
    `${artifact.package.filename} sha256 ${digest} does not match index ${artifact.package.sha256}`,
  )
}
console.log(`verified ${artifact.id} sha256=${digest}`)

if (flags.has('--verify-only')) process.exit(0)

const outDir = path.join(workRoot, artifact.id)
if ((await exists(outDir)) && !flags.has('--force')) {
  console.log(`reusing ${path.relative(repoRoot, outDir)} (pass --force to rebuild)`)
  process.exit(0)
}
if (flags.has('--force')) await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const commandExists = async (name) => {
  try {
    await run('sh', ['-c', `command -v ${name}`])
    return true
  } catch {
    return false
  }
}
if (!(await commandExists('jadx'))) fail('jadx not on PATH (brew install jadx)')

const jadx = async (args, logName) => {
  const logPath = path.join(outDir, `${logName}.log`)
  try {
    const { stdout, stderr } = await run('jadx', args, { maxBuffer: 32 * 1024 * 1024 })
    await writeFile(logPath, `${stdout}\n${stderr}`)
  } catch (error) {
    // jadx exits non-zero when individual classes fail to decompile; keep the log.
    await writeFile(logPath, `${error.stdout ?? ''}\n${error.stderr ?? ''}`)
  }
}

console.log('decoding resources …')
await jadx(['--no-src', '-d', path.join(outDir, 'resources'), packagePath], 'jadx-resources')
console.log('decompiling sources …')
await jadx(['--no-res', '-j', '8', '-d', path.join(outDir, 'sources'), packagePath], 'jadx-sources')

console.log(`
extracted ${artifact.id}
  resources  ${path.relative(repoRoot, path.join(outDir, 'resources'))}
  sources    ${path.relative(repoRoot, path.join(outDir, 'sources'))}

start here (android):
  resources/resources/AndroidManifest.xml
  sources/com/voistech/chat/ui/web/            web container + bridge handlers
  sources/com/github/lzyzsd/jsbridge/          WVJB transport (yy://)
  sources/com/voistech/chat/config/UrlConstant.java
  sources/com/voistech/chat/ui/scan/           QR routing
`)
