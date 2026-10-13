#!/usr/bin/env node
// Verify a vendored App package against native/index.json and extract it for analysis.
// Full output lands in .tmp/rev/<artifactId>/ and is never committed; see native/README.md.

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const indexPath = path.join(repoRoot, 'native/index.json')
const workRoot = path.join(repoRoot, '.tmp/rev')

/** Classes that carry the H5 contract; `--web` decompiles exactly these. */
const WEB_CLASSES = [
  'com.voistech.chat.BuildConfig',
  'com.voistech.chat.config.UrlConstant',
  'com.voistech.chat.ui.base.VoisActivity',
  'com.voistech.chat.ui.config.ConfigManager',
  'com.voistech.chat.ui.scan.ScanHelper',
  'com.voistech.chat.ui.scan.ScanRouter',
  'com.voistech.chat.ui.web.BaseWebView',
  'com.voistech.chat.ui.web.GenericWebViewActivity',
  'com.voistech.chat.ui.web.VoisWebActivity',
  'com.voistech.chat.ui.web.WebConfig',
  'com.voistech.chat.ui.web.WechatPayHelper',
  'com.voistech.chat.ui.web.bridge.BridgeCallbackManager',
  'com.voistech.chat.ui.web.bridge.BridgeResponseBuilder',
  'com.voistech.chat.ui.web.bridge.BridgeType',
  'com.voistech.chat.ui.web.bridge.JsBridgeHandler',
  'com.github.lzyzsd.jsbridge.BridgeUtil',
  'com.github.lzyzsd.jsbridge.BridgeWebViewClient',
]

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

function usage() {
  console.log(`usage: node native/tools/extract.mjs [<artifactId|packagePath>] [options]

  (no options)          decode resources + decompile all sources into .tmp/rev/<id>/
  --verify-only         verify the package SHA-256 against native/index.json, then stop
  --force               rebuild the full extraction even when it already exists
  --class <fqcn>        decompile one class into .tmp/rev/<id>/classes/ (about 6s)
  --web                 decompile the H5-contract class set (see WEB_CLASSES)
  --out <dir>           output directory for --class/--web (default .tmp/rev/<id>/classes)

examples:
  node native/tools/extract.mjs --web
  node native/tools/extract.mjs --class com.voistech.chat.ui.web.bridge.BridgeType
  node native/tools/extract.mjs android-5.0.4+504 --verify-only`)
}

const argv = process.argv.slice(2)
const flags = []
const positional = []
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i]
  if (arg === '--class' || arg === '--out') {
    flags.push([arg, argv[(i += 1)]])
  } else if (arg.startsWith('--')) {
    flags.push([arg, null])
  } else {
    positional.push(arg)
  }
}
const known = ['--verify-only', '--force', '--help', '--web', '--class', '--out']
for (const [flag, value] of flags) {
  if (!known.includes(flag)) fail(`unknown flag ${flag}`)
  if (value === undefined && (flag === '--class' || flag === '--out')) fail(`${flag} needs a value`)
}
const has = (flag) => flags.some(([name]) => name === flag)
const valueOf = (flag) => flags.find(([name]) => name === flag)?.[1]

if (has('--help')) {
  usage()
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

if (has('--verify-only')) process.exit(0)

const outDir = path.join(workRoot, artifact.id)
const commandExists = async (name) => {
  try {
    await run('sh', ['-c', `command -v ${name}`])
    return true
  } catch {
    return false
  }
}
if (!(await commandExists('jadx'))) fail('jadx not on PATH (brew install jadx)')

/** jadx exits non-zero when individual classes fail to decompile; keep the log either way. */
const jadx = async (args, logPath) => {
  try {
    const { stdout, stderr } = await run('jadx', args, { maxBuffer: 32 * 1024 * 1024 })
    await writeFile(logPath, `${stdout}\n${stderr}`)
  } catch (error) {
    await writeFile(logPath, `${error.stdout ?? ''}\n${error.stderr ?? ''}`)
  }
}

const classesOut = valueOf('--out') ?? path.join(outDir, 'classes')
if (has('--class') || has('--web')) {
  const classes = has('--web') ? WEB_CLASSES : [valueOf('--class')]
  await mkdir(classesOut, { recursive: true })
  const javaFiles = async () => (await readdir(classesOut)).filter((f) => f.endsWith('.java'))
  for (const fqcn of classes) {
    const before = new Set(await javaFiles())
    await jadx(
      ['--no-res', '--single-class', fqcn, '--single-class-output', `${classesOut}/`, packagePath],
      path.join(outDir, `jadx-class-${fqcn.replaceAll('.', '_')}.log`),
    )
    const written = (await javaFiles()).filter((f) => !before.has(f))
    console.log(
      `${written.length > 0 ? 'ok  ' : 'FAIL'} ${fqcn} → ${written.join(', ') || '(no file)'}`,
    )
  }
  console.log(`\nclasses in ${path.relative(repoRoot, classesOut)}`)
  process.exit(0)
}

if ((await exists(outDir)) && !has('--force')) {
  console.log(`reusing ${path.relative(repoRoot, outDir)} (pass --force to rebuild)`)
  process.exit(0)
}
if (has('--force')) await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

console.log('decoding resources …')
await jadx(
  ['--no-src', '-d', path.join(outDir, 'resources'), packagePath],
  path.join(outDir, 'jadx-resources.log'),
)
console.log('decompiling sources …')
await jadx(
  ['--no-res', '-j', '8', '-d', path.join(outDir, 'sources'), packagePath],
  path.join(outDir, 'jadx-sources.log'),
)

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
