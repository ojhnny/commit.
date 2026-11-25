import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { addDays, weekdayOf } from '@/domain/dates'
import { evaluateDay, type LogIndex } from '@/domain/progress'
import type { DateKey, Habit } from '@/domain/types'
import { cn } from '@/lib/utils'
import { heatBg } from './heat'

const CELL = 10
const GAP = 2

/**
 * Compact recent-weeks graph for the dashboard list view. Shows as many whole
 * weeks as fit the container, ending with the current week. Decorative: the
 * full, interactive heatmap lives on the habit page.
 */
export function MiniHeatmap({ habit, logs, today, className }: { habit: Habit; logs: LogIndex; today: DateKey; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [weeks, setWeeks] = useState(16)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWeeks(Math.max(4, Math.min(53, Math.floor((el.clientWidth + GAP) / (CELL + GAP)))))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const columns = useMemo(() => {
    const lastSunday = addDays(today, -weekdayOf(today))
    const first = addDays(lastSunday, -7 * (weeks - 1))
    return Array.from({ length: weeks }, (_, c) =>
      Array.from({ length: 7 }, (_, r) => {
        const date = addDays(first, c * 7 + r)
        return date > today ? null : evaluateDay(habit, logs.get(date), date, today)
      }),
    )
  }, [habit, logs, today, weeks])

  return (
    <div ref={ref} aria-hidden className={cn('flex min-w-0 gap-[2px] overflow-hidden', className)}>
      {columns.map((col, c) => (
        <div key={c} className="flex flex-col gap-[2px]">
          {col.map((day, r) => (
            <span
              key={r}
              className={cn(
                'size-[10px] rounded-[2px]',
                day ? heatBg(day.status) : 'bg-transparent',
                day?.date === today && 'ring-1 ring-text-muted',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
