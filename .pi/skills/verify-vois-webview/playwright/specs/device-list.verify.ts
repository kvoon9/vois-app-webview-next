import { readNumber } from '../../../../../packages/mcp/src/index.ts'
import { capturedBody, readDevices } from '../api.ts'
import { expect, test } from '../fixtures.ts'

test.use({ featureId: 'device-list' })

test('renders one row per device and agrees with the captured list', async ({
  page,
  capture,
  evidence,
}) => {
  const from = capture.mark()
  await page.goto('/#/devices')
  await expect(page.getByRole('heading', { name: '已连接设备' })).toBeVisible()

  const call = await capture.waitForNetwork(
    { method: 'POST', path: '/v2/subuser/manager-get-all-device' },
    from,
  )
  expect(call.status).toBe(200)
  const body = capturedBody(call, 'manager-get-all-device')
  expect(readNumber(body, 'errcode')).toBe(0)

  const devices = readDevices(body)
  const rows = page.locator('main ul li')
  await expect(rows).toHaveCount(devices.length)
  if (devices.length === 0) await expect(page.getByText('暂无已连接设备')).toBeVisible()

  for (const device of devices) {
    if (device.nick === undefined) continue
    const row = rows.filter({ hasText: device.nick }).first()
    await expect(row).toContainText(device.nick)
    if (device.product !== undefined && device.product !== '') {
      await expect(row).toContainText(device.product)
    }
    if (device.battery !== undefined && device.battery > 0) {
      await expect(row).toContainText(`${device.battery}%`)
    } else {
      await expect(row).not.toContainText('%')
    }
    await expect(row).not.toContainText('微喇号')
    await expect(row).not.toContainText('IMEI')
  }
  await expect(page.locator('[aria-label="离线"]')).toHaveCount(0)

  await evidence.screenshot(page, 'list')
  await evidence.aria(page, 'list')
  evidence.json(
    'devices',
    JSON.stringify({
      count: devices.length,
      rows: devices.map((device) => ({
        nick: device.nick,
        product: device.product,
        battery: device.battery,
      })),
    }),
  )
})

test('opens the device detail for the row the user chose', async ({ page, capture, evidence }) => {
  const from = capture.mark()
  await page.goto('/#/devices')
  const call = await capture.waitForNetwork(
    { method: 'POST', path: '/v2/subuser/manager-get-all-device' },
    from,
  )
  const devices = readDevices(capturedBody(call, 'manager-get-all-device'))
  if (devices.length === 0) test.skip(true, 'the debug account owns no devices')

  const first = devices[0]
  if (first?.nick === undefined || first.userId === undefined) {
    throw new Error('the captured device row has no nick or user_id')
  }
  const row = page.locator('main ul li').filter({ hasText: first.nick }).first()
  await expect(row).toBeVisible()
  await row.getByRole('button').click()

  await expect(page).toHaveURL(new RegExp(`#/devices/${first.userId}$`), { timeout: 30_000 })
  // The page title is the tappable header button; the heading is the device nick.
  await expect(page.getByRole('button', { name: '设备详情' })).toBeVisible()
  await evidence.screenshot(page, 'detail-open')
})

test('opens the renewal page from the header action', async ({ page, capture, evidence }) => {
  const from = capture.mark()
  await page.goto('/#/devices')
  await capture.waitForNetwork({ method: 'POST', path: '/v2/subuser/manager-get-all-device' }, from)

  await page.getByRole('button', { name: '待续费设备' }).click()
  await expect(page).toHaveURL(/#\/devices\/recharge$/)
  // The page title is the tappable header button, not a heading.
  await expect(page.getByRole('button', { name: '待续费设备' }).first()).toBeVisible()

  const call = await capture.waitForNetwork(
    { method: 'POST', path: '/v2/subuser/simcard-get-all-need-renew' },
    from,
  )
  expect(call.status).toBe(200)
  await evidence.screenshot(page, 'recharge')
})
