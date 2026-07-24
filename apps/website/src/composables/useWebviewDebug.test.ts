import { expect, test } from 'vite-plus/test'
import { redactUrl } from './useWebviewDebug'

test('resolves full URL from string input', () => {
  expect(redactUrl('/v2/report?token=secret&sign=private', 'https://preview.test/')).toBe(
    'https://preview.test/v2/report?token=secret&sign=private',
  )
})
