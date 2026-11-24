import { addDays, endOfYear, MONTH_SHORT, parts, startOfYear, weekdayOf } from './dates'
import type { DateKey } from './types'

export interface YearGrid {
  year: number
  /** Week columns, each with 7 slots (Sun..Sat). `null` = outside the year. */
  weeks: (DateKey | null)[][]
  /** Month labels positioned on week columns. */
  months: { label: string; month: number; column: number }[]
}

/**
 * GitHub-style grid for one calendar year: columns are weeks starting Sunday,
 * rows are weekdays. Days outside the year are `null` so alignment is kept.
 * A year spans 53 or 54 week columns depending on its first weekday and length.
 */
export function buildYearGrid(year: number): YearGrid {
  const first = startOfYear(year)
  const last = endOfYear(year)
  const gridStart = addDays(first, -weekdayOf(first))
  const weeks: (DateKey | null)[][] = []
  const months: YearGrid['months'] = []

  let cursor = gridStart
  let column = 0
  while (cursor <= last) {
    const week: (DateKey | null)[] = []
    for (let row = 0; row < 7; row++) {
      const inYear = cursor >= first && cursor <= last
      week.push(inYear ? cursor : null)
      if (inYear) {
        const { month, day } = parts(cursor)
        // Consecutive month starts are always >= 4 columns apart, so labels never collide.
        if (day === 1) months.push({ label: MONTH_SHORT[month - 1] ?? '', month, column })
      }
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
    column++
  }
  return { year, weeks, months }
}

export interface MonthGrid {
  year: number
  month: number
  /** Rows of 7 (Sun..Sat); null = padding outside the month. */
  rows: (DateKey | null)[][]
}

export function buildMonthGrid(year: number, month: number): MonthGrid {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const rows: (DateKey | null)[][] = []
  let row: (DateKey | null)[] = Array.from({ length: weekdayOf(first) }, () => null)
  let cursor = first
  while (parts(cursor).month === month) {
    row.push(cursor)
    if (row.length === 7) {
      rows.push(row)
      row = []
    }
    cursor = addDays(cursor, 1)
  }
  if (row.length) {
    while (row.length < 7) row.push(null)
    rows.push(row)
  }
  return { year, month, rows }
}
