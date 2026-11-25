import { useMemo } from 'react'
import { formatHours, isTimeBased, overallTime } from '@/domain/time'
import type { DateKey, Habit, HabitLog } from '@/domain/types'

interface TimeSummaryProps {
  habits: Habit[]
  logsByHabit: ReadonlyMap<string, ReadonlyMap<DateKey, HabitLog>>
  today: DateKey
}

/** "Time spent 2.5 h today · 9 h this week · 31 h this month" across time-based habits (DESIGN.md §8 Time spent). */
export function TimeSummary({ habits, logsByHabit, today }: TimeSummaryProps) {
  const timed = useMemo(() => habits.filter(isTimeBased), [habits])
  const t = useMemo(() => overallTime(timed, logsByHabit, today), [timed, logsByHabit, today])
  if (timed.length === 0) return null
  return (
    <p className="tabular text-small text-text-faint">
      <span className="mr-2 text-text-muted">Time spent</span>
      <span className="whitespace-nowrap">
        <span className="font-medium text-text">{formatHours(t.today)}</span> today
      </span>
      <span aria-hidden> · </span>
      <span className="whitespace-nowrap">
        <span className="font-medium text-text-muted">{formatHours(t.week)}</span> this week
      </span>
      <span aria-hidden> · </span>
      <span className="whitespace-nowrap">
        <span className="font-medium text-text-muted">{formatHours(t.month)}</span> this month
      </span>
    </p>
  )
}
