import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { MONTH_LONG, parts, WEEKDAY_INITIAL, WEEKDAY_SHORT } from '@/domain/dates'
import { buildMonthGrid } from '@/domain/heatmap'
import { evaluateDay, type LogIndex } from '@/domain/progress'
import type { DateKey, Habit } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ariaLabelForDay } from './describe'
import { heatBg } from './heat'

interface MonthlyCalendarProps {
  habit: Habit
  logs: LogIndex
  today: DateKey
  year: number
  month: number
  onMonthChange: (year: number, month: number) => void
  onSelectDate: (date: DateKey) => void
}

/**
 * Touch-friendly month view (44px day buttons) — the accessible alternative to
 * the dense annual heatmap on phones (DESIGN.md §9).
 */
export function MonthlyCalendar({ habit, logs, today, year, month, onMonthChange, onSelectDate }: MonthlyCalendarProps) {
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month])
  const { year: ty, month: tm } = parts(today)
  const canGoNext = year * 12 + month < ty * 12 + tm
  const start = parts(habit.startDate)
  const canGoPrev = year * 12 + month > start.year * 12 + start.month

  const shift = (delta: number) => {
    const idx = year * 12 + (month - 1) + delta
    onMonthChange(Math.floor(idx / 12), (idx % 12) + 1)
  }

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shift(-1)} disabled={!canGoPrev}>
          <ChevronLeft />
        </Button>
        <div className="text-body font-medium" aria-live="polite">
          {MONTH_LONG[month - 1]} {year}
        </div>
        <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shift(1)} disabled={!canGoNext}>
          <ChevronRight />
        </Button>
      </div>
      <table className="w-full table-fixed border-separate border-spacing-y-1" role="grid" aria-label={`${habit.name}, ${MONTH_LONG[month - 1]} ${year}`}>
        <thead>
          <tr>
            {WEEKDAY_INITIAL.map((d, i) => (
              <th key={i} scope="col" className="pb-1 text-micro font-normal text-text-muted">
                <abbr title={WEEKDAY_SHORT[i]} className="no-underline">
                  {d}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row, r) => (
            <tr key={r}>
              {row.map((date, c) => {
                if (!date) return <td key={c} />
                const day = evaluateDay(habit, logs.get(date), date, today)
                const isToday = date === today
                return (
                  <td key={c} className="p-0 text-center">
                    <button
                      type="button"
                      onClick={() => onSelectDate(date)}
                      aria-label={ariaLabelForDay(day)}
                      aria-current={isToday ? 'date' : undefined}
                      className={cn(
                        'mx-auto flex h-11 w-full max-w-[52px] flex-col items-center justify-center gap-1 rounded-md transition-colors hover:bg-surface-2',
                        isToday && 'bg-surface-2 ring-1 ring-border',
                        day.status === 'future' || day.status === 'before-start' ? 'text-text-faint' : 'text-text',
                      )}
                    >
                      <span className="tabular text-small leading-none">{parts(date).day}</span>
                      <span aria-hidden className={cn('size-2 rounded-[2px]', heatBg(day.status), day.status === 'future' && 'opacity-50')} />
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
