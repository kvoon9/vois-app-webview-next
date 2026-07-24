import { readFileSync } from 'node:fs'

const file = process.argv[2] || '.tmp/vois-webview-debug/events.jsonl'
const content = readFileSync(file, 'utf-8').trim()
const lines = content
  ? content
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  : []

const byType = {}
for (const e of lines) {
  byType[e.type] = (byType[e.type] || 0) + 1
}

console.log(`Total events: ${lines.length}`)
for (const [t, n] of Object.entries(byType)) {
  console.log(`  ${t}: ${n}`)
}
console.log()

for (const e of lines) {
  switch (e.type) {
    case 'lifecycle': {
      const v = e.visible === false ? ' (background)' : e.visible === true ? ' (foreground)' : ''
      console.log(`  ${e.event.padEnd(10)}  ${e.url}${v}`)
      break
    }
    case 'network': {
      const err = e.error ? ` ERROR: ${e.error}` : ''
      console.log(`  [${e.method} ${e.status} ${e.duration}ms] ${e.url}${err}`)
      break
    }
    case 'console':
      console.log(`  [console:${e.level}] ${e.args.map(String).join(' ')}`)
      break
    case 'error':
      console.log(`  [JS ERROR] ${e.message}`)
      break
    default:
      console.log(`  [${e.type}] ${JSON.stringify(e)}`)
  }
}
