import { asJsonObject, readNumber } from '../../../../../packages/mcp/src/index.ts'
import { expect, test } from '../fixtures.ts'
import { pathnameOf } from '../debug.ts'

test.use({ featureId: 'smoke' })

test('signs in through the debug server and captures the call that fed the home screen', async ({
  page,
  capture,
  evidence,
}) => {
  const from = capture.mark()
  await page.goto('/#/')

  await expect(page.locator('#app')).toBeVisible()
  await expect(page.getByText('已登录帐号')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('出了点问题')

  const call = await capture.waitForNetwork({ path: '/v2/user/get-my-user-info' }, from)
  expect(call.status).toBe(200)
  const body = asJsonObject(call.responseBody)
  if (body === undefined) throw new Error('the captured response body is not a JSON object')
  expect(readNumber(body, 'errcode')).toBe(0)

  const events = capture.since(from)
  expect(events.some((event) => event.type === 'lifecycle')).toBe(true)

  await evidence.screenshot(page, 'home')
  await evidence.aria(page, 'home')
  evidence.json(
    'capture',
    JSON.stringify({
      sessionStartedAt: capture.sessionStartedAt,
      eventCount: events.length,
      call: {
        method: call.method,
        path: pathnameOf(call),
        status: call.status,
        errcode: readNumber(body, 'errcode'),
      },
    }),
  )
})
