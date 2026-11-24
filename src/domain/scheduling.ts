import { WEEKDAY_SHORT, weekdayOf } from './dates'
import type { DateKey, GoalVersion, Habit, Schedule, SchedulePreset, Weekday } from './types'

export const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5]
export const WEEKENDS: Weekday[] = [0, 6]

export function makeSchedule(preset: SchedulePreset, customDays: Weekday[] = []): Schedule {
  switch (preset) {
    case 'daily':
      return { preset, days: [...ALL_DAYS] }
    case 'weekdays':
      return { preset, days: [...WEEKDAYS] }
    case 'weekends':
      return { preset, days: [...WEEKENDS] }
    case 'custom': {
      const days = [...new Set(customDays)].sort((a, b) => a - b)
      return { preset, days }
    }
  }
}

/** Normalizes a custom selection back to a named preset when it matches one. */
export function normalizeSchedule(schedule: Schedule): Schedule {
  const key = [...schedule.days].sort((a, b) => a - b).join(',')
  if (key === ALL_DAYS.join(',')) return makeSchedule('daily')
  if (key === WEEKDAYS.join(',')) return makeSchedule('weekdays')
  if (key === WEEKENDS.join(',')) return makeSchedule('weekends')
  return makeSchedule('custom', schedule.days)
}

export function isScheduledOn(schedule: Schedule, date: DateKey): boolean {
  return schedule.days.includes(weekdayOf(date))
}

export function describeSchedule(schedule: Schedule): string {
  switch (schedule.preset) {
    case 'daily':
      return 'Every day'
    case 'weekdays':
      return 'Weekdays'
    case 'weekends':
      return 'Weekends'
    case 'custom':
      if (schedule.days.length === 0) return 'No days'
      // Order Mon..Sun for readability.
      return [...schedule.days]
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d) => WEEKDAY_SHORT[d])
        .join(', ')
  }
}

/**
 * The goal version that applies on `date`: the latest version whose effective
 * date is on or before `date`. Dates before the first version use the first one.
 */
export function goalFor(habit: Pick<Habit, 'goalVersions'>, date: DateKey): GoalVersion {
  const versions = habit.goalVersions
  const first = versions[0]
  if (!first) throw new Error('Habit has no goal versions')
  let current = first
  for (const v of versions) {
    if (v.effectiveDate <= date) current = v
    else break
  }
  return current
}

export function currentGoal(habit: Pick<Habit, 'goalVersions'>, today: DateKey): GoalVersion {
  return goalFor(habit, today)
}

function sameGoal(a: GoalVersion, b: Omit<GoalVersion, 'effectiveDate'>): boolean {
  return (
    a.targetValue === b.targetValue &&
    a.unit === b.unit &&
    (a.customUnit ?? '') === (b.customUnit ?? '') &&
    a.schedule.days.join(',') === b.schedule.days.join(',')
  )
}

/**
 * Returns the habit's goal versions with `next` applied from `effectiveDate`.
 * - No-op when the goal is unchanged.
 * - Replaces a version that already starts on `effectiveDate` (same-day edits).
 * - Drops versions that would start after `effectiveDate` (a newer edit wins).
 */
export function applyGoalChange(
  versions: GoalVersion[],
  next: Omit<GoalVersion, 'effectiveDate'>,
  effectiveDate: DateKey,
): GoalVersion[] {
  const active = goalFor({ goalVersions: versions }, effectiveDate)
  const isBeforeFirst = versions[0] !== undefined && effectiveDate < versions[0].effectiveDate
  if (!isBeforeFirst && sameGoal(active, next)) return versions
  const kept = versions.filter((v) => v.effectiveDate < effectiveDate)
  const merged = [...kept, { ...next, effectiveDate }]
  // Collapse consecutive identical versions.
  return merged.filter((v, i) => {
    const prev = merged[i - 1]
    return !prev || !sameGoal(prev, v)
  })
}
