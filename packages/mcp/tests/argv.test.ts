import { expect, test } from 'vite-plus/test'

import { parseArgv } from '../src/argv.ts'

test('parseArgv reads ports, files, and help', () => {
  expect(parseArgv(['--port', '3021', '--events-file', '/tmp/e.jsonl'])).toEqual({
    overrides: { ports: [3021], eventsFile: '/tmp/e.jsonl' },
    help: false,
  })
  expect(parseArgv(['--port=3021', '--port', '4000', '-h'])).toEqual({
    overrides: { ports: [3021, 4000] },
    help: true,
  })
  expect(parseArgv([])).toEqual({ overrides: {}, help: false })
})

test('parseArgv never consumes another flag as a value', () => {
  const parsed = parseArgv(['--port', '--events-file', 'x'])
  expect(parsed.error).toBe('--port needs a value')
  expect(parsed.overrides).toEqual({ eventsFile: 'x' })
})

test('parseArgv reports missing and malformed values', () => {
  expect(parseArgv(['--port']).error).toBe('--port needs a value')
  expect(parseArgv(['--port=abc']).error).toBe('--port got "abc", expected a port number')
  expect(parseArgv(['--port', '0']).error).toBe('--port got "0", expected a port number')
  expect(parseArgv(['--events-file']).error).toBe('--events-file needs a value')
  expect(parseArgv(['--bogus']).error).toBe('Unknown argument: --bogus')
})
