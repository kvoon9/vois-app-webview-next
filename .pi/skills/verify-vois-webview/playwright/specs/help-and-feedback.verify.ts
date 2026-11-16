import { expect, test } from '../fixtures.ts'

test.use({ featureId: 'help-and-feedback' })

test('opens the help index and its guide', async ({ page, evidence }) => {
  await page.goto('/#/help')
  await expect(page.getByRole('button', { name: '帮助', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '手机平台挂后台帮助' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '联系我们' })).toBeVisible()
  await expect(page.getByRole('button', { name: '提交反馈' })).toBeVisible()
  await expect(page.getByRole('button', { name: '报告问题' })).toBeVisible()

  await evidence.screenshot(page, 'help')
  await evidence.aria(page, 'help')

  await page.getByRole('button', { name: '手机平台挂后台帮助' }).click()
  await expect(page).toHaveURL(/#\/help-guide$/)
  await expect(page.getByRole('button', { name: '手机平台挂后台帮助' })).toBeVisible()
  await expect(page.locator('iframe')).toBeVisible()
  await evidence.aria(page, 'help-guide')
})

test('selects a feedback category and caps the description at 60 characters without submitting', async ({
  page,
  evidence,
}) => {
  await page.goto('/#/feedback')
  await expect(page.getByRole('button', { name: '提交反馈' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '类别' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '您的反馈' })).toBeVisible()
  await expect(page.getByText('0/60')).toBeVisible()

  const textarea = page.getByRole('textbox', { name: '告诉我们您的想法。' })
  await expect(textarea).toBeVisible()
  await page.getByRole('button', { name: '设备' }).click()
  await expect(page.getByRole('button', { name: '设备' })).toHaveClass(/chip-selected/)
  await textarea.fill('x'.repeat(120))
  expect(await textarea.inputValue()).toHaveLength(60)
  await expect(page.getByText('60/60')).toBeVisible()

  await evidence.screenshot(page, 'feedback')
  await evidence.aria(page, 'feedback')
  evidence.json('cap', JSON.stringify({ typed: 120, accepted: 60, counter: '60/60' }))
})

test('shows the report form without submitting', async ({ page, evidence }) => {
  await page.goto('/#/report')
  await expect(page.getByRole('button', { name: '报告问题' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '问题类型' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '发生了什么问题？' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '描述该问题。' })).toBeVisible()
  await expect(page.getByText('0/60')).toBeVisible()
  await expect(page.getByRole('button', { name: '报告', exact: true })).toBeVisible()
  await evidence.aria(page, 'report')
})
