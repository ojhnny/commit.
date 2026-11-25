import type { DateKey, Weekday } from './types'

/**
 * Calendar-day arithmetic on `YYYY-MM-DD` keys.
 *
 * Days are converted to integer "day numbers" (days since 1970-01-01 in UTC) so
 * that adding days, comparing and iterating never touch local-time DST shifts.
 * Only `toDateKey` reads local time, to decide which calendar day "now" is.
 */

const MS_PER_DAY = 86_400_000
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidDateKey(value: string): value is DateKey {
  const m = KEY_RE.exec(value)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo)
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** `month` is 1-based. */
export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

export function parts(key: DateKey): { year: number; month: number; day: number } {
  const m = KEY_RE.exec(key)
  if (!m) throw new Error(`Invalid date key: ${key}`)
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

export function makeKey(year: number, month: number, day: number): DateKey {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function toDayNumber(key: DateKey): number {
  const { year, month, day } = parts(key)
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY)
}

export function fromDayNumber(n: number): DateKey {
  const d = new Date(n * MS_PER_DAY)
  return makeKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

/** The local calendar day of `now`. */
export function toDateKey(now: Date): DateKey {
  return makeKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function addDays(key: DateKey, amount: number): DateKey {
  return fromDayNumber(toDayNumber(key) + amount)
}

export function diffDays(a: DateKey, b: DateKey): number {
  return toDayNumber(a) - toDayNumber(b)
}

export function weekdayOf(key: DateKey): Weekday {
  // 1970-01-01 was a Thursday (4).
  return (((toDayNumber(key) + 4) % 7) + 7) % 7 as Weekday
}

export function compareKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function minKey(a: DateKey, b: DateKey): DateKey {
  return a < b ? a : b
}

export function maxKey(a: DateKey, b: DateKey): DateKey {
  return a > b ? a : b
}

/** Inclusive range of keys from `start` to `end`. Empty when start > end. */
export function eachDay(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = []
  const s = toDayNumber(start)
  const e = toDayNumber(end)
  for (let n = s; n <= e; n++) out.push(fromDayNumber(n))
  return out
}

export function startOfYear(year: number): DateKey {
  return makeKey(year, 1, 1)
}

export function endOfYear(year: number): DateKey {
  return makeKey(year, 12, 31)
}

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

/** "Tue, Nov 24, 2026" */
export function formatDateMedium(key: DateKey): string {
  const { year, month, day } = parts(key)
  return `${WEEKDAY_SHORT[weekdayOf(key)]}, ${MONTH_SHORT[month - 1]} ${day}, ${year}`
}

/** "Tuesday, November 24, 2026" */
export function formatDateLong(key: DateKey): string {
  const { year, month, day } = parts(key)
  return `${WEEKDAY_LONG[weekdayOf(key)]}, ${MONTH_LONG[month - 1]} ${day}, ${year}`
}

/** "Nov 24" */
export function formatDateShort(key: DateKey): string {
  const { month, day } = parts(key)
  return `${MONTH_SHORT[month - 1]} ${day}`
}

/** Relative label used in activity lists: Today / Yesterday / "Mon, Nov 23". */
export function formatRelative(key: DateKey, today: DateKey): string {
  const d = diffDays(today, key)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  const { year } = parts(key)
  const { year: ty } = parts(today)
  const { month, day } = parts(key)
  const base = `${WEEKDAY_SHORT[weekdayOf(key)]}, ${MONTH_SHORT[month - 1]} ${day}`
  return year === ty ? base : `${base}, ${year}`
}
