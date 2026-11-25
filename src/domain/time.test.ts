import { describe, expect, it } from 'vitest'
import { makeSchedule } from './scheduling'
import { formatHours, habitTime, isTimeBased, overallTime, startOfMonth, startOfWeek } from './time'
import type { Habit, HabitLog } from './types'

const habit = (id: string, versions: [string, Habit['goalVersions'][number]['unit']][]): Habit => ({
  id, name: id, startDate: versions[0]![0], order: 0, createdAt: 'x', updatedAt: 'x', archivedAt: null,
  goalVersions: versions.map(([effectiveDate, unit]) => ({ effectiveDate, unit, targetValue: 1, schedule: makeSchedule('daily') })),
})
const log = (habitId: string, date: string, value: number): HabitLog => ({ id: `${habitId}${date}`, habitId, date, value, createdAt: 'x', updatedAt: 'x' })

describe('time spent', () => {
  // Wed Nov 25 2026: week starts Sun Nov 22, month Nov 1.
  const today = '2026-11-25'

  it('finds week and month starts', () => {
    expect(startOfWeek(today)).toBe('2026-11-22')
    expect(startOfWeek('2026-11-22')).toBe('2026-11-22')
    expect(startOfMonth(today)).toBe('2026-11-01')
  })

  it('counts minutes and hours per goal version and ignores other units', () => {
    // Minutes until Nov 20, pages from Nov 20, hours from Nov 24.
    const h = habit('h', [['2026-10-01', 'minutes'], ['2026-11-20', 'pages'], ['2026-11-24', 'hours']])
    const logs = [
      log('h', '2026-10-31', 90), // 1.5 h, total only
      log('h', '2026-11-02', 30), // 0.5 h, month
      log('h', '2026-11-21', 40), // pages: ignored
      log('h', '2026-11-24', 2), // 2 h, week
      log('h', '2026-11-25', 1.25), // today
      log('h', '2026-11-26', 5), // future: ignored
    ]
    expect(habitTime(h, logs, today)).toEqual({ today: 1.25, week: 3.25, month: 3.75, total: 5.25 })
    expect(isTimeBased(h)).toBe(true)
    expect(isTimeBased(habit('p', [['2026-01-01', 'pages']]))).toBe(false)
  })

  it('adds up habits, including archived ones', () => {
    const a = habit('a', [['2026-11-01', 'hours']])
    const b = { ...habit('b', [['2026-11-01', 'minutes']]), archivedAt: 'x' }
    const c = habit('c', [['2026-11-01', 'completion']])
    const byHabit = new Map([
      ['a', new Map([['2026-11-25', log('a', '2026-11-25', 1)]])],
      ['b', new Map([['2026-11-23', log('b', '2026-11-23', 30)]])],
      ['c', new Map([['2026-11-25', log('c', '2026-11-25', 1)]])],
    ])
    expect(overallTime([a, b, c], byHabit, today)).toEqual({ today: 1, week: 1.5, month: 1.5, total: 1.5 })
  })

  it('formats hours', () => {
    expect(formatHours(0)).toBe('0 h')
    expect(formatHours(0.75)).toBe('45 min')
    expect(formatHours(0.001)).toBe('1 min')
    expect(formatHours(0.999)).toBe('1 h')
    expect(formatHours(2.5)).toBe('2.5 h')
    expect(formatHours(186.04)).toBe('186 h')
  })
})
