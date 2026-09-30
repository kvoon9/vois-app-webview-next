import type { CliOverrides } from './config.ts'

/** What argv parsing produced: overrides, help, and the first misuse found. */
export interface ParsedArgv {
  overrides: CliOverrides
  help: boolean
  error?: string
}

/** Reads the value for a flag that takes one, refusing to swallow a flag. */
function valueAfter(
  argv: string[],
  index: number,
  flag: string,
): { value: string; next: number } | { error: string } {
  const next = argv[index + 1]
  if (next === undefined || next.startsWith('--')) {
    return { error: `${flag} needs a value` }
  }
  return { value: next, next: index + 1 }
}

/**
 * Parses `--port`/`--events-file` style argv. A flag value that is missing or
 * looks like another flag is reported as `error` instead of being consumed,
 * so `--port --events-file x` still parses `x` for `--events-file`.
 */
export function parseArgv(argv: string[]): ParsedArgv {
  const ports: number[] = []
  let eventsFile: string | undefined
  let help = false
  let error: string | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      help = true
    } else if (arg === '--port' || arg.startsWith('--port=')) {
      const read = arg.startsWith('--port=')
        ? { value: arg.slice('--port='.length), next: index }
        : valueAfter(argv, index, '--port')
      if ('error' in read) {
        error ??= read.error
        continue
      }
      index = read.next
      const port = Number.parseInt(read.value, 10)
      if (!Number.isInteger(port) || port <= 0) {
        error ??= `--port got "${read.value}", expected a port number`
      } else {
        ports.push(port)
      }
    } else if (arg === '--events-file' || arg.startsWith('--events-file=')) {
      const read = arg.startsWith('--events-file=')
        ? { value: arg.slice('--events-file='.length), next: index }
        : valueAfter(argv, index, '--events-file')
      if ('error' in read) {
        error ??= read.error
        continue
      }
      index = read.next
      eventsFile = read.value
    } else {
      error ??= `Unknown argument: ${arg}`
    }
  }

  const overrides: CliOverrides = {}
  if (ports.length > 0) overrides.ports = ports
  if (eventsFile !== undefined) overrides.eventsFile = eventsFile
  const parsed: ParsedArgv = { overrides, help }
  if (error !== undefined) parsed.error = error
  return parsed
}
