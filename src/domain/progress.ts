import { addDays, eachDay, maxKey } from './dates'
import { goalFor, isScheduledOn } from './scheduling'
import type { DateKey, DayEvaluation, DayStatus, Habit, HabitLog } from './types'

export type LogIndex = ReadonlyMap<DateKey, HabitLog>

export function indexLogs(logs: readonly HabitLog[]): Map<DateKey, HabitLog> {
  const map = new Map<DateKey, HabitLog>()
  for (const log of logs) map.set(log.date, log)
  return map
}

/** Progress-based status, ignoring date rules. */
export function statusForValue(value: number, target: number): 'partial' | 'done' | 'exceeded' | null {
  if (!(value > 0)) return null
  // Guard against float noise (1.1 + 0.9).
  const eps = 1e-9
  if (value < target - eps) return 'partial'
  if (value > target + eps) return 'exceeded'
  return 'done'
}

/**
 * Evaluates one calendar day for one habit.
 *
 * Rules (spec §7, §10):
 * - Future days and days before the start date are never missed.
 * - Today with nothing logged is `pending` (gray), never `missed`.
 * - Past scheduled days with no progress are `missed` (orange).
 * - Partial progress is its own state.
 * - Unscheduled (rest) days are gray unless something was logged; logged rest
 *   days show their progress color but do not count toward consistency.
 */
export function evaluateDay(
  habit: Pick<Habit, 'goalVersions' | 'startDate'>,
  log: HabitLog | undefined,
  date: DateKey,
  today: DateKey,
): DayEvaluation {
  const goal = goalFor(habit, date)
  const scheduled = isScheduledOn(goal.schedule, date)
  const value = log?.value ?? 0
  const ratio = goal.targetValue > 0 ? value / goal.targetValue : 0
  const base = { date, value, goal, scheduled, ratio, note: log?.note }

  if (date > today) return { ...base, status: 'future', eligible: false }
  if (date < habit.startDate) return { ...base, status: 'before-start', eligible: false }

  const progress = statusForValue(value, goal.targetValue)

  if (!scheduled) {
    return { ...base, status: progress ?? 'rest', eligible: false }
  }

  if (date === today) {
    // Today only counts once the target is reached.
    const complete = progress === 'done' || progress === 'exceeded'
    return { ...base, status: progress ?? 'pending', eligible: complete }
  }

  return { ...base, status: progress ?? 'missed', eligible: true }
}

export function isComplete(status: DayStatus): boolean {
  return status === 'done' || status === 'exceeded'
}

/** Evaluates every day from the habit start (or `from`) through `to`. */
export function evaluateRange(
  habit: Pick<Habit, 'goalVersions' | 'startDate'>,
  logs: LogIndex,
  from: DateKey,
  to: DateKey,
  today: DateKey,
): DayEvaluation[] {
  return eachDay(from, to).map((d) => evaluateDay(habit, logs.get(d), d, today))
}

/** The last `count` days ending today, oldest first (dashboard preview). */
export function recentDays(
  habit: Pick<Habit, 'goalVersions' | 'startDate'>,
  logs: LogIndex,
  today: DateKey,
  count = 7,
): DayEvaluation[] {
  return evaluateRange(habit, logs, addDays(today, -(count - 1)), today, today)
}

/** Whether a day can be logged/edited: on or after start, not in the future. */
export function canLog(habit: Pick<Habit, 'startDate'>, date: DateKey, today: DateKey): boolean {
  return date >= habit.startDate && date <= today
}

/** The first day eligible for evaluation, clamped so we never iterate before start. */
export function evaluationStart(habit: Pick<Habit, 'startDate'>, from: DateKey): DateKey {
  return maxKey(habit.startDate, from)
}

export const STATUS_LABEL: Record<DayStatus, string> = {
  future: 'Upcoming',
  'before-start': 'Before start',
  rest: 'Rest day',
  pending: 'Not logged yet',
  missed: 'Missed',
  partial: 'Partial',
  done: 'Target reached',
  exceeded: 'Target exceeded',
}
