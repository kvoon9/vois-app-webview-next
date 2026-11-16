import type { Page } from '@playwright/test'
import { readNumber } from '../../../../../packages/mcp/src/index.ts'
import { capturedBody, readDeviceDetail, type DeviceDetail } from '../api.ts'
import { pathnameOf, type DebugCapture } from '../debug.ts'
import { expect, test } from '../fixtures.ts'
import { loadDeviceList } from '../ui.ts'

test.use({ featureId: 'device-detail' })

const DETAIL_CALL = { method: 'POST', path: '/v2/subuser/device-get-detail' }

async function openFirstDevice(page: Page, capture: DebugCapture): Promise<DeviceDetail> {
  const devices = await loadDeviceList(page, capture)
  const first = devices[0]
  if (first?.nick === undefined || first.userId === undefined) {
    throw new Error('the captured list has no device with a nick and user_id')
  }
  const from = capture.mark()
  await page
    .locator('main ul li')
    .filter({ hasText: first.nick })
    .first()
    .getByRole('button')
    .click()
  await expect(page).toHaveURL(new RegExp(`#/devices/${first.userId}$`), { timeout: 30_000 })

  const call = await capture.waitForNetwork(DETAIL_CALL, from)
  expect(call.status).toBe(200)
  const body = capturedBody(call, 'device-get-detail')
  expect(readNumber(body, 'errcode')).toBe(0)
  return readDeviceDetail(body)
}

test('renders the detail fields from device-get-detail and cancels the unbind dialog', async ({
  page,
  capture,
  evidence,
}) => {
  const detail = await openFirstDevice(page, capture)

  await expect(page.getByRole('button', { name: '设备详情' })).toBeVisible()
  await expect(page.getByRole('button', { name: '修改设备头像' })).toBeVisible()
  if (detail.nick !== undefined) {
    await expect(page.getByRole('heading', { name: detail.nick })).toBeVisible()
  }
  await expect(page.getByText(`激活时间: ${detail.activeAt ?? '暂无'}`)).toBeVisible()
  if (detail.product !== undefined) {
    await expect(page.getByText(`型号: ${detail.product}`)).toBeVisible()
  }
  if (detail.imei !== undefined) {
    await expect(page.getByText(`设备号: ${detail.imei}`)).toBeVisible()
    await expect(page.getByRole('button', { name: '复制设备号' })).toBeVisible()
  }
  if (detail.sdkVersion !== undefined) {
    await expect(page.getByText(`版本号: ${detail.sdkVersion}`)).toBeVisible()
  }
  if (detail.userNum !== undefined) {
    await expect(page.getByText(`微喇号: ${detail.userNum}`)).toBeVisible()
  }

  // The action needs an ICCID; the rows only need the card object.
  const rechargeEntry = page.getByRole('button', { name: '缴费充值' })
  if (detail.canRecharge) await expect(rechargeEntry).toBeVisible()
  else await expect(rechargeEntry).toHaveCount(0)

  if (detail.hasSimCard) {
    await expect(page.getByText(`卡 ICCID: ${detail.iccid || '暂无'}`)).toBeVisible()
    await expect(page.getByText(`卡到期时间: ${detail.expiryDate || '暂无'}`)).toBeVisible()
    if (detail.cardRecharge) await expect(page.getByText('卡片状态: 需充值')).toBeVisible()
    await expect(page.getByRole('link', { name: '流量卡充值记录' })).toBeVisible()
  }

  await expect(page.getByRole('link', { name: '群组管理' })).toBeVisible()
  await expect(page.getByRole('link', { name: '联系人管理' })).toBeVisible()
  const emergency = page.getByRole('link', { name: '紧急联系人设置' })
  if (detail.emergencySupport === false) await expect(emergency).toHaveCount(0)
  else await expect(emergency).toBeVisible()

  const positionCard = detail.locationSupport === true || detail.reminderSupport === true
  const shareSwitch = page.getByRole('switch', { name: '共享位置' })
  if (positionCard) {
    if (detail.locationSupport === false) await expect(shareSwitch).toHaveCount(0)
    else await expect(shareSwitch).toBeVisible()
    for (const name of ['位置和围栏', '轨迹记录', '轨迹上报设置']) {
      const link = page.getByRole('link', { name })
      if (detail.locationSupport === false) await expect(link).toHaveCount(0)
      else await expect(link).toBeVisible()
    }
    const reminder = page.getByRole('link', { name: '提醒' })
    if (detail.reminderSupport === false) await expect(reminder).toHaveCount(0)
    else await expect(reminder).toBeVisible()
  } else {
    await expect(shareSwitch).toHaveCount(0)
  }
  await expect(page.getByRole('button', { name: '解除绑定' })).toBeVisible()

  const dialogMark = capture.mark()
  await page.getByRole('button', { name: '解除绑定' }).click()
  await expect(page.getByText('是否解除绑定设备？')).toBeVisible()
  await expect(page.getByRole('button', { name: '取消' })).toBeVisible()
  await expect(page.getByRole('button', { name: '确定' })).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByText('是否解除绑定设备？')).toHaveCount(0)
  // Absence needs a bounded window; the debug client posts a write immediately after the call.
  await page.waitForTimeout(1000)
  const unbindCalls = capture
    .since(dialogMark)
    .filter(
      (event) => event.type === 'network' && pathnameOf(event) === '/v2/subuser/device-unbind',
    )
  expect(unbindCalls).toHaveLength(0)

  await evidence.screenshot(page, 'detail')
  await evidence.aria(page, 'detail')
  evidence.json('detail', JSON.stringify(detail))
})

test('cold deep link fetches the device and asks native to close the page', async ({
  page,
  capture,
  evidence,
}) => {
  const devices = await loadDeviceList(page, capture)
  const first = devices[0]
  if (first?.userId === undefined) throw new Error('the captured list has no device id')

  await page.goto('about:blank')
  const from = capture.mark()
  await page.goto(`/#/devices/${first.userId}`)
  const call = await capture.waitForNetwork(DETAIL_CALL, from)
  expect(call.status).toBe(200)
  const detail = readDeviceDetail(capturedBody(call, 'device-get-detail'))
  await expect(page.getByRole('button', { name: '设备详情' })).toBeVisible()
  if (detail.nick !== undefined) {
    await expect(page.getByRole('heading', { name: detail.nick })).toBeVisible()
  }

  const backMark = capture.mark()
  await page.getByRole('button', { name: '返回' }).click()
  const closePage = await capture.waitForBridge(
    { direction: 'send', protocol: 'close-page' },
    backMark,
  )
  await expect(page).toHaveURL(new RegExp(`#/devices/${first.userId}$`))

  await evidence.screenshot(page, 'cold-detail')
  evidence.json(
    'close-page',
    JSON.stringify({ direction: closePage.direction, protocol: closePage.protocol }),
  )
})

test('back pops to the list without a close-page handshake', async ({
  page,
  capture,
  evidence,
}) => {
  const devices = await loadDeviceList(page, capture)
  const first = devices[0]
  if (first?.nick === undefined || first.userId === undefined) {
    throw new Error('the captured list has no device with a nick and user_id')
  }
  const openFrom = capture.mark()
  await page
    .locator('main ul li')
    .filter({ hasText: first.nick })
    .first()
    .getByRole('button')
    .click()
  await expect(page).toHaveURL(new RegExp(`#/devices/${first.userId}$`), { timeout: 30_000 })
  await capture.waitForNetwork(DETAIL_CALL, openFrom)

  const backMark = capture.mark()
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page).toHaveURL(/#\/devices$/)
  await expect(page.getByRole('heading', { name: '已连接设备' })).toBeVisible()
  // Absence needs a bounded window; the debug client posts a write immediately after the call.
  await page.waitForTimeout(1000)
  const closePage = capture
    .since(backMark)
    .filter((event) => event.type === 'bridge' && event.protocol === 'close-page')
  expect(closePage).toHaveLength(0)

  evidence.json('back-pop', JSON.stringify({ url: '#/devices', closePageEvents: 0 }))
})
