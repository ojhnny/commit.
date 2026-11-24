import { useMemo } from 'react'
import { evaluateDay, isComplete } from '@/domain/progress'
import type { DateKey, Habit, HabitLog } from '@/domain/types'
import { cn } from '@/lib/utils'
import { heatBg } from '@/components/heatmap/heat'

interface TodaySummaryProps {
  habits: Habit[]
  logsByHabit: ReadonlyMap<string, ReadonlyMap<DateKey, HabitLog>>
  today: DateKey
}

/** "2 of 5 done today" with one segment per habit that's due today. */
export function TodaySummary({ habits, logsByHabit, today }: TodaySummaryProps) {
  const days = useMemo(
    () =>
      habits
        .filter((h) => h.startDate <= today)
        .map((h) => ({ habit: h, day: evaluateDay(h, logsByHabit.get(h.id)?.get(today), today, today) })),
    [habits, logsByHabit, today],
  )
  const due = days.filter((d) => d.day.scheduled)
  const done = due.filter((d) => isComplete(d.day.status)).length
  const resting = days.length - due.length

  if (due.length === 0) {
    return <p className="text-small text-text-muted">Nothing scheduled today. Enjoy the rest day.</p>
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className="text-small text-text-muted">
        <span className="tabular font-medium text-text">{done}</span> of <span className="tabular">{due.length}</span> done today
        {done === due.length ? ' · all done' : null}
        {resting > 0 ? <span className="text-text-faint"> · {resting} resting</span> : null}
      </p>
      <div className="flex max-w-[320px] gap-1" aria-hidden>
        {due.map(({ habit, day }) => (
          <span
            key={habit.id}
            title={habit.name}
            className={cn('h-1.5 flex-1 rounded-full', day.status === 'pending' ? 'bg-surface-3' : heatBg(day.status))}
          />
        ))}
      </div>
    </div>
  )
}
