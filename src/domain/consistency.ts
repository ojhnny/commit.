import { evaluateRange, isComplete, type LogIndex } from './progress'
import type { DateKey, DayEvaluation, Habit } from './types'

export interface ConsistencySummary {
  /** Scheduled days that count: past scheduled days + today once completed. */
  eligibleDays: number
  completedDays: number
  partialDays: number
  missedDays: number
  /** 0..100, or null when there are no eligible days yet. */
  consistency: number | null
}

/**
 * consistency = completed scheduled days / eligible scheduled days × 100
 *
 * Excludes future dates, dates before the start, unscheduled days and today
 * while today's target is not yet reached (spec §10).
 */
export function summarizeConsistency(days: readonly DayEvaluation[]): ConsistencySummary {
  let eligibleDays = 0
  let completedDays = 0
  let partialDays = 0
  let missedDays = 0
  for (const day of days) {
    if (!day.eligible) continue
    eligibleDays++
    if (isComplete(day.status)) completedDays++
    else if (day.status === 'partial') partialDays++
    else if (day.status === 'missed') missedDays++
  }
  const consistency = eligibleDays === 0 ? null : (completedDays / eligibleDays) * 100
  return { eligibleDays, completedDays, partialDays, missedDays, consistency }
}

export function computeConsistency(
  habit: Pick<Habit, 'goalVersions' | 'startDate'>,
  logs: LogIndex,
  today: DateKey,
): ConsistencySummary {
  if (habit.startDate > today) return summarizeConsistency([])
  return summarizeConsistency(evaluateRange(habit, logs, habit.startDate, today, today))
}

/** Rounds for display: 92.4 → "92%", null → "—". */
export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value)}%`
}
