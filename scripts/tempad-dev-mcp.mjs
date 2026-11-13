#!/usr/bin/env node
// Boots the TemPad Dev MCP server, self-installing the pinned version into
// ~/.vois/tools/tempad-mcp on first use (machine-local store, shared across
// worktrees). Keeps .pi/mcp.json free of machine paths and makes this file the
// single source of truth for the version pin.
//
// The pin must match the browser extension: MCP 0.11.0 pairs with extension
// 0.23.x. Upgrade both together.
import { spawn, spawnSync } from 'node:child_process'
import { connect } from 'node:net'
import { mkdirSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'

const VERSION = '0.11.0'
const root = path.join(homedir(), '.vois', 'tools', 'tempad-mcp')
const pkgDir = path.join(root, 'node_modules', '@tempad-dev', 'mcp')
const entry = path.join(pkgDir, 'dist', 'cli.mjs')

const installedVersion = () => {
  try {
    return JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version
  } catch {
    return undefined
  }
}

if (installedVersion() !== VERSION) {
  mkdirSync(root, { recursive: true })
  // stdout carries the MCP protocol; install chatter goes to stderr only.
  const res = spawnSync('pnpm', ['add', `@tempad-dev/mcp@${VERSION}`, '--silent'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  if (res.stderr) process.stderr.write(res.stderr)
  if (res.error || res.status !== 0) {
    process.stderr.write(
      `tempad-dev: failed to install @tempad-dev/mcp@${VERSION} into ${root} ` +
        `(${res.error ?? `exit ${res.status}`}). Check pnpm availability/network, then restart the session.\n`,
    )
    process.exit(1)
  }
}

// The CLI starts its own hub, but a cold start takes about 20 seconds, which
// outlives an MCP client's initialize timeout and looks like "extension not
// connected". Warm the hub first so the first tool call is immediate.
const hubEntry = path.join(pkgDir, 'dist', 'hub.mjs')
const socketPath = path.join(tmpdir(), 'tempad-dev', 'run', 'mcp.sock')

function socketAnswers() {
  return new Promise((resolve) => {
    const socket = connect(socketPath)
    const done = (answer) => {
      socket.destroy()
      resolve(answer)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    setTimeout(() => done(false), 500)
  })
}

if (!(await socketAnswers())) {
  spawn(process.execPath, [hubEntry], { detached: true, stdio: 'ignore' }).unref()
  const deadline = Date.now() + 30000
  while (Date.now() < deadline && !(await socketAnswers())) {
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

const child = spawn(process.execPath, [entry], { stdio: 'inherit' })
// Forward termination so pi killing the wrapper never orphans the server.
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(sig, () => child.kill(sig))
}
child.on('exit', (code) => process.exit(code ?? 0))
