import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { findRepoRoot, parseJson, redactJson } from '../../../../packages/mcp/src/index.ts'

/** Writes the artifacts a proof names, at the path the verify skill owns. */
export interface Evidence {
  readonly dir: string
  screenshot(page: Page, name: string): Promise<string>
  aria(page: Page, name: string): Promise<string>
  /** Writes already-serialized JSON with credentials redacted. */
  json(name: string, value: string): string
}

export function createEvidence(
  featureId: string,
  root = findRepoRoot(import.meta.dirname),
): Evidence {
  if (root === undefined) throw new Error(`no pnpm-workspace.yaml above ${import.meta.dirname}`)
  const dir = join(root, 'apps/website/.tmp/verify', featureId)
  mkdirSync(dir, { recursive: true })
  return {
    dir,
    async screenshot(page, name) {
      const path = join(dir, `${name}.png`)
      await page.screenshot({ path })
      return path
    },
    async aria(page, name) {
      const path = join(dir, `${name}.aria.txt`)
      writeFileSync(path, await page.locator('body').ariaSnapshot())
      return path
    },
    json(name, value) {
      const path = join(dir, `${name}.json`)
      const parsed = parseJson(value)
      writeFileSync(
        path,
        parsed === undefined ? `${value}\n` : `${JSON.stringify(redactJson(parsed), null, 2)}\n`,
      )
      return path
    },
  }
}
