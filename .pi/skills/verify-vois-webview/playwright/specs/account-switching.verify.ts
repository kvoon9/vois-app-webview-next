import {
  asJsonObject,
  readNumber,
  readString,
  readValue,
} from '../../../../../packages/mcp/src/index.ts'
import { capturedBody } from '../api.ts'
import { expect, test } from '../fixtures.ts'

test.use({ featureId: 'account-switching' })

test('lists the signed-in account and opens the add-account form without submitting', async ({
  page,
  capture,
  evidence,
}) => {
  const from = capture.mark()
  await page.goto('/#/')
  await expect(page.getByRole('region', { name: '已登录帐号' })).toBeVisible()

  const call = await capture.waitForNetwork(
    { method: 'POST', path: '/v2/user/get-my-user-info' },
    from,
  )
  expect(call.status).toBe(200)
  const body = capturedBody(call, 'get-my-user-info')
  expect(readNumber(body, 'errcode')).toBe(0)
  const data = asJsonObject(readValue(body, 'data'))
  const user = asJsonObject(readValue(data ?? {}, 'user'))
  if (user === undefined) throw new Error('get-my-user-info data.user is not an object')
  const nick = readString(user, 'nick')
  const num = readString(user, 'num')

  const accounts = page.getByRole('region', { name: '已登录帐号' })
  const current = accounts.getByRole('button', { pressed: true })
  await expect(current).toBeVisible()
  await expect(current).toContainText('当前帐号')
  await expect(current).toContainText('App 账号')
  if (nick !== undefined) await expect(current).toContainText(nick)
  if (num !== undefined) await expect(current).toContainText(num)

  await evidence.screenshot(page, 'home')
  await evidence.aria(page, 'home')
  evidence.json('account', JSON.stringify({ nick, num }))

  await page.getByRole('link', { name: '添加账号' }).click()
  // A cold Vite server can spend most of the default budget transforming a lazy route.
  await expect(page).toHaveURL(/#\/login$/, { timeout: 30_000 })
  await expect(page.getByRole('combobox', { name: '帐号／手机号' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '密码' })).toBeVisible()
  await expect(page.locator('main').getByRole('button', { name: '登录' })).toBeVisible()

  await evidence.screenshot(page, 'login')
  await evidence.aria(page, 'login')
})
