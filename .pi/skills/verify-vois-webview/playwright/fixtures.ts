import { test as base } from '@playwright/test'
import { createDebugCapture, type DebugCapture } from './debug.ts'
import { createEvidence, type Evidence } from './evidence.ts'

export interface VerifyFixtures {
  capture: DebugCapture
  evidence: Evidence
}

export interface VerifyOptions {
  featureId: string
}

export const test = base.extend<VerifyFixtures & VerifyOptions>({
  featureId: ['unnamed', { option: true }],
  // Playwright requires a destructuring pattern even when the fixture has no dependencies.
  // oxlint-disable-next-line no-empty-pattern
  capture: async ({}, use) => {
    const capture = await createDebugCapture()
    await use(capture)
    // Evidence from a replaced server instance is stale, so a restart fails the spec.
    await capture.assertSameSession()
  },
  evidence: async ({ featureId }, use) => {
    await use(createEvidence(featureId))
  },
})

export { expect } from '@playwright/test'
