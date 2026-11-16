import type { Page } from '@playwright/test'
import { capturedBody, readDevices, type DeviceRow } from './api.ts'
import type { DebugCapture } from './debug.ts'

/** Opens the device list and returns the devices its captured call reported. */
export async function loadDeviceList(page: Page, capture: DebugCapture): Promise<DeviceRow[]> {
  const from = capture.mark()
  await page.goto('/#/devices')
  const call = await capture.waitForNetwork(
    { method: 'POST', path: '/v2/subuser/manager-get-all-device' },
    from,
  )
  return readDevices(capturedBody(call, 'manager-get-all-device'))
}
