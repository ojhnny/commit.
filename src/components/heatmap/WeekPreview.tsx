import { WEEKDAY_INITIAL, weekdayOf } from '@/domain/dates'
import type { DayEvaluation } from '@/domain/types'
import { cn } from '@/lib/utils'
import { ariaLabelForDay } from './describe'
import { heatBg } from './heat'

/** Compact 7-day strip used on dashboard cards. */
export function WeekPreview({ days, today }: { days: DayEvaluation[]; today: string }) {
  return (
    <ol aria-label="Last 7 days" className="flex gap-1">
      {days.map((day) => (
        <li key={day.date} className="flex flex-col items-center gap-1" aria-label={ariaLabelForDay(day)}>
          <span
            aria-hidden
            className={cn(
              'size-3.5 rounded-[3px]',
              heatBg(day.status),
              day.date === today && 'ring-1 ring-text-muted ring-offset-1 ring-offset-surface',
            )}
          />
          <span aria-hidden className={cn('text-[10px] leading-none', day.date === today ? 'text-text' : 'text-text-faint')}>
            {WEEKDAY_INITIAL[weekdayOf(day.date)]}
          </span>
        </li>
      ))}
    </ol>
  )
}
