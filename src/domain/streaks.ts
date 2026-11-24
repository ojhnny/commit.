import { evaluateRange, isComplete, type LogIndex } from './progress'
import type { DateKey, DayEvaluation, Habit } from './types'

export interface StreakSummary {
  current: number
  longest: number
}

/**
 * Streaks count consecutive *scheduled* days whose target was reached.
 *
 * - Unscheduled rest days are skipped (they neither extend nor break a streak).
 * - Partial or missed scheduled days break a streak.
 * - Today, while still unfinished, is skipped so it can't break the streak early.
 *
 * `days` must be in chronological order and end on today.
 */
export function summarizeStreaks(days: readonly DayEvaluation[]): StreakSummary {
  let longest = 0
  let run = 0
  for (const day of days) {
    if (!day.scheduled || day.status === 'future' || day.status === 'before-start') continue
    if (isComplete(day.status)) {
      run++
      if (run > longest) longest = run
    } else if (day.status === 'pending' || (day.status === 'partial' && !day.eligible)) {
      // Today, not finished yet: does not break the run.
      continue
    } else {
      run = 0
    }
  }

  // Current streak: walk backwards from the end.
  let current = 0
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i]
    if (!day) continue
    if (!day.scheduled || day.status === 'future' || day.status === 'before-start') continue
    if (isComplete(day.status)) {
      current++
      continue
    }
    if (i === days.length - 1 && (day.status === 'pending' || day.status === 'partial') && !day.eligible) {
      // Today in progress.
      continue
    }
    break
  }

  return { current, longest }
}

export function computeStreaks(
  habit: Pick<Habit, 'goalVersions' | 'startDate'>,
  logs: LogIndex,
  today: DateKey,
): StreakSummary {
  if (habit.startDate > today) return { current: 0, longest: 0 }
  return summarizeStreaks(evaluateRange(habit, logs, habit.startDate, today, today))
}
