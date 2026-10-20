import type { ReminderRepeat } from '~/utils/device-api'

/** The subset of vue-i18n's `t` this formatter needs. */
type Translate = (key: string, named?: Record<string, string | number>) => string

const DAY_KEYS = [
  'reminderDayMon',
  'reminderDayTue',
  'reminderDayWed',
  'reminderDayThu',
  'reminderDayFri',
  'reminderDaySat',
  'reminderDaySun',
] as const

/**
 * Repeat text the way the native app prints it: one label for the presets, the
 * explicit day list for a custom weekly rule, and the day of month for a
 * monthly one.
 */
export function reminderRepeatLabel(t: Translate, repeat: ReminderRepeat, days: number[]): string {
  if (repeat === 'daily') return t('device.reminderDaily')
  if (repeat === 'weekdays') return t('device.reminderWeekdays')
  if (repeat === 'monthly') return t('device.reminderMonthly', { days: days.join('、') })
  if (repeat === 'custom') {
    const labels = days
      .filter((day) => day >= 1 && day <= 7)
      .map((day) => t(`device.${DAY_KEYS[day - 1]!}`))
    return labels.length > 0 ? labels.join('、') : t('device.reminderCustom')
  }
  return t('device.reminderOnce')
}
