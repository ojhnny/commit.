import { describe, expect, it } from 'vitest'
import { computeConsistency } from './consistency'
import { addDays, daysInYear, diffDays, eachDay, isLeapYear, isValidDateKey, toDateKey, weekdayOf } from './dates'
import { buildMonthGrid, buildYearGrid } from './heatmap'
import { evaluateDay, indexLogs } from './progress'
import { applyGoalChange, goalFor, isScheduledOn, makeSchedule, normalizeSchedule } from './scheduling'
import { computeHabitStats } from './stats'
import { computeStreaks } from './streaks'
import type { DateKey, GoalVersion, Habit, HabitLog, Weekday } from './types'
import { formatProgress, formatTarget } from './units'
import { parseAmount, validateHabitForm, validateLogValue } from './validation'

// ---------------------------------------------------------------- helpers

const TS = '2026-01-01T00:00:00.000Z'

function habit(start: DateKey, goal: Partial<GoalVersion> = {}, extra: GoalVersion[] = []): Habit {
  return {
    id: 'h',
    name: 'Test',
    startDate: start,
    goalVersions: [
      { effectiveDate: start, targetValue: 120, unit: 'minutes', schedule: makeSchedule('daily'), ...goal },
      ...extra,
    ],
    order: 0,
    createdAt: TS,
    updatedAt: TS,
    archivedAt: null,
  }
}

function logs(entries: Record<DateKey, number>): Map<DateKey, HabitLog> {
  return indexLogs(
    Object.entries(entries).map(([date, value]) => ({
      id: date,
      habitId: 'h',
      date,
      value,
      createdAt: TS,
      updatedAt: TS,
    })),
  )
}

// ---------------------------------------------------------------- dates

describe('dates', () => {
  it('handles leap years', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2026)).toBe(false)
    expect(isLeapYear(1900)).toBe(false)
    expect(isLeapYear(2000)).toBe(true)
    expect(daysInYear(2024)).toBe(366)
    expect(isValidDateKey('2024-02-29')).toBe(true)
    expect(isValidDateKey('2026-02-29')).toBe(false)
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('computes weekdays', () => {
    expect(weekdayOf('2026-11-24')).toBe(2) // Tuesday
    expect(weekdayOf('2024-02-29')).toBe(4) // Thursday
    expect(weekdayOf('2023-01-01')).toBe(0) // Sunday
  })

  it('is DST-safe across a spring-forward boundary', () => {
    expect(eachDay('2026-03-07', '2026-03-10')).toEqual(['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'])
    expect(diffDays('2026-11-02', '2026-10-31')).toBe(2)
  })

  it('reads the local calendar day', () => {
    expect(toDateKey(new Date(2026, 10, 24, 23, 59))).toBe('2026-11-24')
    expect(toDateKey(new Date(2026, 10, 25, 0, 0))).toBe('2026-11-25')
  })
})

// ---------------------------------------------------------------- heatmap grid

describe('year grid', () => {
  it('contains every day of a leap year exactly once, Sunday-aligned', () => {
    const grid = buildYearGrid(2024)
    const days = grid.weeks.flat().filter((d): d is string => d !== null)
    expect(days.length).toBe(366)
    expect(days[0]).toBe('2024-01-01')
    expect(days.at(-1)).toBe('2024-12-31')
    for (const week of grid.weeks) {
      week.forEach((d, row) => {
        if (d) expect(weekdayOf(d)).toBe(row)
      })
    }
    // 2024-01-01 is a Monday → row 1 of the first column.
    expect(grid.weeks[0]?.[1]).toBe('2024-01-01')
    expect(grid.weeks[0]?.[0]).toBeNull()
  })

  it('places month labels on the column containing the 1st', () => {
    const grid = buildYearGrid(2026)
    expect(grid.months).toHaveLength(12)
    for (const m of grid.months) {
      const col = grid.weeks[m.column]!
      expect(col.some((d) => d?.endsWith(`-${String(m.month).padStart(2, '0')}-01`))).toBe(true)
    }
    // No two labels closer than 4 columns.
    for (let i = 1; i < grid.months.length; i++) {
      expect(grid.months[i]!.column - grid.months[i - 1]!.column).toBeGreaterThanOrEqual(4)
    }
  })

  it('spans 53 or 54 columns', () => {
    for (const y of [2016, 2020, 2021, 2023, 2024, 2026, 2028, 2033]) {
      const n = buildYearGrid(y).weeks.length
      expect(n === 53 || n === 54).toBe(true)
    }
    // 2028 is a leap year starting on Saturday → 54 columns.
    expect(buildYearGrid(2028).weeks.length).toBe(54)
  })

  it('builds a month grid with padding', () => {
    const feb = buildMonthGrid(2024, 2)
    const days = feb.rows.flat().filter(Boolean)
    expect(days.length).toBe(29)
    expect(feb.rows[0]?.slice(0, 5)).toEqual([null, null, null, null, '2024-02-01']) // Thursday
  })
})

// ---------------------------------------------------------------- scheduling

describe('scheduling', () => {
  it('resolves presets', () => {
    expect(makeSchedule('weekdays').days).toEqual([1, 2, 3, 4, 5])
    expect(makeSchedule('weekends').days).toEqual([0, 6])
    expect(makeSchedule('custom', [5, 1, 1, 3] as Weekday[]).days).toEqual([1, 3, 5])
    expect(normalizeSchedule(makeSchedule('custom', [0, 6] as Weekday[])).preset).toBe('weekends')
  })

  it('checks scheduled days', () => {
    expect(isScheduledOn(makeSchedule('weekdays'), '2026-11-24')).toBe(true) // Tue
    expect(isScheduledOn(makeSchedule('weekdays'), '2026-11-22')).toBe(false) // Sun
  })

  it('picks the goal version effective on a date', () => {
    const h = habit('2026-01-01', {}, [
      { effectiveDate: '2026-06-01', targetValue: 60, unit: 'minutes', schedule: makeSchedule('weekdays') },
    ])
    expect(goalFor(h, '2026-05-31').targetValue).toBe(120)
    expect(goalFor(h, '2026-06-01').targetValue).toBe(60)
    expect(goalFor(h, '2025-01-01').targetValue).toBe(120)
  })

  it('appends, replaces and collapses goal versions', () => {
    const base = habit('2026-01-01').goalVersions
    const changed = applyGoalChange(base, { targetValue: 90, unit: 'minutes', schedule: makeSchedule('daily') }, '2026-03-01')
    expect(changed).toHaveLength(2)
    // Same-day edit replaces.
    const again = applyGoalChange(changed, { targetValue: 100, unit: 'minutes', schedule: makeSchedule('daily') }, '2026-03-01')
    expect(again).toHaveLength(2)
    expect(again[1]?.targetValue).toBe(100)
    // No-op edit keeps the array.
    expect(applyGoalChange(again, { targetValue: 100, unit: 'minutes', schedule: makeSchedule('daily') }, '2026-03-05')).toBe(again)
    // Reverting to the original on the same day collapses back to one version.
    const reverted = applyGoalChange(again, { targetValue: 120, unit: 'minutes', schedule: makeSchedule('daily') }, '2026-03-01')
    expect(reverted).toHaveLength(1)
  })
})

// ---------------------------------------------------------------- day status

describe('evaluateDay', () => {
  const h = habit('2026-11-01')
  const today = '2026-11-24'

  it('maps progress to colors per spec (120 minute target)', () => {
    const l = logs({ '2026-11-10': 60, '2026-11-11': 120, '2026-11-12': 150 })
    expect(evaluateDay(h, l.get('2026-11-09'), '2026-11-09', today).status).toBe('missed')
    expect(evaluateDay(h, l.get('2026-11-10'), '2026-11-10', today).status).toBe('partial')
    expect(evaluateDay(h, l.get('2026-11-11'), '2026-11-11', today).status).toBe('done')
    expect(evaluateDay(h, l.get('2026-11-12'), '2026-11-12', today).status).toBe('exceeded')
  })

  it('never marks today, the future or pre-start days as missed', () => {
    expect(evaluateDay(h, undefined, today, today).status).toBe('pending')
    expect(evaluateDay(h, undefined, '2026-11-25', today).status).toBe('future')
    expect(evaluateDay(h, undefined, '2026-10-31', today).status).toBe('before-start')
  })

  it('treats unscheduled days as rest', () => {
    const wk = habit('2026-11-01', { schedule: makeSchedule('weekdays') })
    const sunday = '2026-11-22'
    expect(evaluateDay(wk, undefined, sunday, today).status).toBe('rest')
    expect(evaluateDay(wk, undefined, sunday, today).eligible).toBe(false)
  })

  it('handles float noise when adding decimals', () => {
    const hrs = habit('2026-11-01', { targetValue: 2, unit: 'hours' })
    const l = logs({ '2026-11-20': 1.1 + 0.9 })
    expect(evaluateDay(hrs, l.get('2026-11-20'), '2026-11-20', today).status).toBe('done')
  })

  it('evaluates past days by the goal that applied then', () => {
    const changed = habit('2026-11-01', {}, [
      { effectiveDate: '2026-11-15', targetValue: 60, unit: 'minutes', schedule: makeSchedule('daily') },
    ])
    const l = logs({ '2026-11-10': 90, '2026-11-20': 90 })
    expect(evaluateDay(changed, l.get('2026-11-10'), '2026-11-10', today).status).toBe('partial') // 90/120
    expect(evaluateDay(changed, l.get('2026-11-20'), '2026-11-20', today).status).toBe('exceeded') // 90/60
  })

  it('formats target and progress', () => {
    expect(formatTarget(goalFor(h, today))).toBe('120 minutes / day')
    expect(formatProgress(goalFor(h, today), 90)).toBe('90 / 120 minutes')
  })
})

// ---------------------------------------------------------------- consistency

describe('consistency', () => {
  const today = '2026-11-24' // Tuesday

  it('divides completed by eligible scheduled days and ignores unfinished today', () => {
    const h = habit('2026-11-20') // Fri..Tue = 4 past days + today
    const l = logs({ '2026-11-20': 120, '2026-11-21': 60, '2026-11-23': 200 })
    const c = computeConsistency(h, l, today)
    expect(c.eligibleDays).toBe(4)
    expect(c.completedDays).toBe(2)
    expect(c.partialDays).toBe(1)
    expect(c.missedDays).toBe(1)
    expect(c.consistency).toBe(50)
  })

  it('includes today once the target is completed', () => {
    const h = habit('2026-11-23')
    const c = computeConsistency(h, logs({ '2026-11-23': 120, [today]: 120 }), today)
    expect(c.eligibleDays).toBe(2)
    expect(c.consistency).toBe(100)
  })

  it('excludes unscheduled days', () => {
    const h = habit('2026-11-21', { schedule: makeSchedule('weekdays') }) // Sat start
    const c = computeConsistency(h, logs({ '2026-11-23': 120 }), today)
    expect(c.eligibleDays).toBe(1) // only Monday
    expect(c.consistency).toBe(100)
  })

  it('returns null when nothing is eligible yet', () => {
    expect(computeConsistency(habit(today), logs({}), today).consistency).toBeNull()
    expect(computeConsistency(habit('2026-12-01'), logs({}), today).consistency).toBeNull()
  })

  it('keeps historical accomplishments after a goal increase', () => {
    const before = habit('2026-11-20', { targetValue: 60 })
    const l = logs({ '2026-11-20': 60, '2026-11-21': 60, '2026-11-22': 60, '2026-11-23': 60 })
    expect(computeConsistency(before, l, today).consistency).toBe(100)
    const after: Habit = {
      ...before,
      goalVersions: applyGoalChange(before.goalVersions, { targetValue: 120, unit: 'minutes', schedule: makeSchedule('daily') }, today),
    }
    expect(computeConsistency(after, l, today).consistency).toBe(100)
  })
})

// ---------------------------------------------------------------- streaks

describe('streaks', () => {
  const today = '2026-11-24' // Tuesday

  it('does not break the current streak because today is unfinished', () => {
    const h = habit('2026-11-20')
    const l = logs({ '2026-11-21': 120, '2026-11-22': 120, '2026-11-23': 120 })
    expect(computeStreaks(h, l, today)).toEqual({ current: 3, longest: 3 })
    // Partial progress today also doesn't break it.
    const l2 = logs({ '2026-11-21': 120, '2026-11-22': 120, '2026-11-23': 120, [today]: 30 })
    expect(computeStreaks(h, l2, today).current).toBe(3)
    // Completing today extends it.
    const l3 = logs({ '2026-11-21': 120, '2026-11-22': 120, '2026-11-23': 120, [today]: 120 })
    expect(computeStreaks(h, l3, today).current).toBe(4)
  })

  it('skips unscheduled rest days', () => {
    // Weekdays: Thu 19, Fri 20, (Sat, Sun rest), Mon 23
    const h = habit('2026-11-19', { schedule: makeSchedule('weekdays') })
    const l = logs({ '2026-11-19': 120, '2026-11-20': 120, '2026-11-23': 120 })
    expect(computeStreaks(h, l, today).current).toBe(3)
  })

  it('breaks on partial or missed scheduled days and tracks the longest run', () => {
    const h = habit('2026-11-10')
    const l = logs({
      '2026-11-10': 120, '2026-11-11': 120, '2026-11-12': 120, '2026-11-13': 120, // 4
      '2026-11-14': 50, // partial breaks
      '2026-11-15': 120, '2026-11-16': 120, // 2
      // 17 missed
      '2026-11-18': 120, '2026-11-19': 120, '2026-11-20': 120, '2026-11-21': 120, '2026-11-22': 130, '2026-11-23': 120, // 6
    })
    expect(computeStreaks(h, l, today)).toEqual({ current: 6, longest: 6 })
    const broken = logs({ '2026-11-10': 120, '2026-11-11': 120, '2026-11-12': 120 })
    expect(computeStreaks(h, broken, today)).toEqual({ current: 0, longest: 3 })
  })

  it('computes everything in one pass', () => {
    const h = habit('2026-11-22')
    const s = computeHabitStats(h, logs({ '2026-11-22': 120, '2026-11-23': 120, [today]: 40 }), today)
    expect(s.current).toBe(2)
    expect(s.consistency).toBe(100)
    expect(s.today.status).toBe('partial')
    expect(s.today.eligible).toBe(false)
  })
})

// ---------------------------------------------------------------- validation

describe('validation', () => {
  it('parses decimals and rejects junk', () => {
    expect(parseAmount('1.5')).toBe(1.5)
    expect(parseAmount('1,5')).toBe(1.5)
    expect(parseAmount('.5')).toBe(0.5)
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('-1')).toBeNull()
    expect(parseAmount('')).toBeNull()
  })

  it('validates log values by unit', () => {
    expect(validateLogValue('1.5', true).value).toBe(1.5)
    expect(validateLogValue('1.5', false).error).toBeDefined()
    expect(validateLogValue('3', false).value).toBe(3)
  })

  it('validates the habit form', () => {
    const base = {
      name: 'Read', description: '', kind: 'amount' as const, target: '20', unit: 'pages' as const,
      customUnit: '', preset: 'daily' as const, customDays: [] as Weekday[], startDate: '2026-11-24',
    }
    expect(validateHabitForm(base)).toEqual({})
    expect(validateHabitForm({ ...base, name: ' ' }).name).toBeDefined()
    expect(validateHabitForm({ ...base, target: '0' }).target).toBeDefined()
    expect(validateHabitForm({ ...base, target: '2.5' }).target).toBeDefined() // pages are whole
    expect(validateHabitForm({ ...base, unit: 'hours', target: '2.5' }).target).toBeUndefined()
    expect(validateHabitForm({ ...base, preset: 'custom' }).customDays).toBeDefined()
    expect(validateHabitForm({ ...base, unit: 'custom' }).customUnit).toBeDefined()
    expect(validateHabitForm({ ...base, kind: 'binary', target: '' })).toEqual({})
  })
})
