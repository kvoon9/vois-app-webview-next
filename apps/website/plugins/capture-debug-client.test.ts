import { readFileSync } from 'node:fs'
import { expect, test } from 'vite-plus/test'

const source = readFileSync(new URL('./debug-client-bridge.js', import.meta.url), 'utf8')

test('bridge debug client avoids syntax Chrome 70 cannot parse', () => {
  expect(source).not.toMatch(/\?\.(?!\d)/)
  expect(source).not.toMatch(/\?\?/)
})

test('bridge debug client keeps the debug marker and event channel', () => {
  expect(source).toContain('/__debug/events')
  expect(source).toContain('🟢 WebView debug connected')
  expect(source).toContain("'vois-webview-debug'")
  expect(source).toContain('?capture=bridge')
})
