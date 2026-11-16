import { join, resolve } from 'node:path'
import { defineConfig } from '@playwright/test'

const suiteDir = import.meta.dirname
const repoRoot = resolve(suiteDir, '../../../..')

export default defineConfig({
  testDir: join(suiteDir, 'specs'),
  testMatch: '**/*.verify.ts',
  // One DevServer owns one capture file, so specs must not interleave their events.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: join(repoRoot, 'apps/website/.tmp/verify/_runner'),
  use: {
    baseURL: process.env.VERIFY_BASE_URL ?? 'http://127.0.0.1:3021',
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    locale: 'zh-CN',
    // The installed Chrome avoids a browser download; set PLAYWRIGHT_CHANNEL=chromium
    // after `playwright install chromium` on a machine without it.
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    // A trace records request URLs and DOM text, so it is scratch, opt-in, and never evidence.
    trace: process.env.VERIFY_TRACE === '1' ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
  },
  reporter: [['list']],
})
