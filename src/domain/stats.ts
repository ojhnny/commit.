import { summarizeConsistency, type ConsistencySummary } from './consistency'
import { evaluateDay, evaluateRange, type LogIndex } from './progress'
import { summarizeStreaks, type StreakSummary } from './streaks'
import type { DateKey, DayEvaluation, Habit } from './types'

export interface HabitStats extends ConsistencySummary, StreakSummary {
  today: DayEvaluation
}

/** Single pass over a habit's history for every statistic shown in the UI. */
export function computeHabitStats(
  habit: Pick<Habit, 'goalVersions' | 'startDate'>,
  logs: LogIndex,
  today: DateKey,
): HabitStats {
  const days = habit.startDate > today ? [] : evaluateRange(habit, logs, habit.startDate, today, today)
  return {
    ...summarizeConsistency(days),
    ...summarizeStreaks(days),
    today: evaluateDay(habit, logs.get(today), today, today),
  }
}
