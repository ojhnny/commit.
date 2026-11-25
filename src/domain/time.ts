import { addDays, parts, weekdayOf } from './dates'
import { goalFor } from './scheduling'
import type { DateKey, Habit, HabitLog } from './types'

/** Hours represented by a value in a unit, or null when the unit isn't a duration. */
export function toHours(unit: string, value: number): number | null {
  if (unit === 'hours') return value
  if (unit === 'minutes') return value / 60
  return null
}

/** True if any goal version of the habit is measured in time. */
export function isTimeBased(habit: Pick<Habit, 'goalVersions'>): boolean {
  return habit.goalVersions.some((g) => g.unit === 'hours' || g.unit === 'minutes')
}

export interface TimeTotals {
  today: number
  week: number
  month: number
  total: number
}

/** Sunday of the week containing `day` (weeks start on Sunday, like the graph). */
export function startOfWeek(day: DateKey): DateKey {
  return addDays(day, -weekdayOf(day))
}

export function startOfMonth(day: DateKey): DateKey {
  const { year, month } = parts(day)
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/**
 * Hours logged for one habit, counted with the goal version that applied on each day
 * (a habit can switch from minutes to hours, or to pages, over time). Future logs are ignored.
 */
export function habitTime(habit: Pick<Habit, 'goalVersions' | 'startDate'>, logs: Iterable<HabitLog>, today: DateKey): TimeTotals {
  const week = startOfWeek(today)
  const month = startOfMonth(today)
  const t: TimeTotals = { today: 0, week: 0, month: 0, total: 0 }
  for (const log of logs) {
    if (log.date > today || log.date < habit.startDate) continue
    const hours = toHours(goalFor(habit, log.date).unit, log.value)
    if (hours === null || hours <= 0) continue
    t.total += hours
    if (log.date >= month) t.month += hours
    if (log.date >= week) t.week += hours
    if (log.date === today) t.today += hours
  }
  return t
}

/** Sum of habitTime over several habits. */
export function overallTime(habits: readonly Habit[], logsByHabit: ReadonlyMap<string, ReadonlyMap<DateKey, HabitLog>>, today: DateKey): TimeTotals {
  const sum: TimeTotals = { today: 0, week: 0, month: 0, total: 0 }
  for (const h of habits) {
    const logs = logsByHabit.get(h.id)
    if (!logs || !isTimeBased(h)) continue
    const t = habitTime(h, logs.values(), today)
    sum.today += t.today
    sum.week += t.week
    sum.month += t.month
    sum.total += t.total
  }
  return sum
}

/** "45 min" under an hour, otherwise "2.5 h" (one decimal at most). */
export function formatHours(hours: number): string {
  if (hours <= 0) return '0 h'
  const minutes = Math.round(hours * 60)
  if (minutes < 60) return `${Math.max(1, minutes)} min`
  const rounded = Math.round(hours * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} h`
}
