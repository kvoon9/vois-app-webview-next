#!/usr/bin/env node
// Starts the REA MCP server with the machine-local defaults that pi used to
// compute through `!command` env values. Claude Code does not execute those, so
// both agents launch this wrapper instead and .pi/mcp.json (symlinked as
// .mcp.json) stays portable.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const home = homedir()
const rea = path.join(home, '.vois', 'tools', 'rea', 'node_modules', '.bin', 'rea')

const brewOpenJDK = () => {
  const brew = '/opt/homebrew/bin/brew'
  if (existsSync(brew)) {
    const result = spawnSync(brew, ['--prefix', 'openjdk'], { encoding: 'utf8' })
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim()
  }
  return '/opt/homebrew/opt/openjdk'
}

if (!existsSync(rea)) {
  console.error(`rea-mcp: REA is not installed at ${rea}`)
  process.exit(1)
}

const child = spawn(rea, ['mcp'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HOPPER_LAUNCHER_PATH:
      process.env.HOPPER_LAUNCHER_PATH ||
      path.join(home, 'Applications', 'Hopper Disassembler.app', 'Contents', 'MacOS', 'hopper'),
    REA_JADX_MCP_JAR:
      process.env.REA_JADX_MCP_JAR ||
      path.join(home, '.vois', 'tools', 'jadx-headless-mcp-0.7.1-all.jar'),
    JAVA_HOME: process.env.JAVA_HOME || brewOpenJDK(),
  },
})

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))

child.on('error', (error) => {
  console.error(`rea-mcp: failed to start ${rea}: ${error.message}`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  process.exit(signal ? 0 : (code ?? 0))
})
