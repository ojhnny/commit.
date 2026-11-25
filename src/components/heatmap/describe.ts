import { formatDateLong, formatDateMedium } from '@/domain/dates'
import { STATUS_LABEL } from '@/domain/progress'
import type { DayEvaluation } from '@/domain/types'
import { formatAmount, formatNumber, formatProgress, formatTarget, isBinary } from '@/domain/units'

export interface DayDescription {
  date: string
  status: string
  progress: string | null
  target: string | null
  percent: string | null
  note?: string
}

/** Human-readable details for tooltips, sheets and screen readers. */
export function describeDay(day: DayEvaluation): DayDescription {
  const binary = isBinary(day.goal)
  const showGoal = day.status !== 'before-start'
  const hasValue = day.value > 0
  const statusLabel = day.status === 'rest' || (!day.scheduled && hasValue) ? (hasValue ? `Rest day · logged` : 'Rest day') : STATUS_LABEL[day.status]
  return {
    date: formatDateMedium(day.date),
    status: statusLabel,
    progress:
      day.status === 'future' || day.status === 'before-start'
        ? null
        : binary
          ? formatAmount(day.goal, day.value)
          : formatProgress(day.goal, day.value),
    target: showGoal ? (binary ? 'Complete once' : formatTarget(day.goal).replace(' / day', '')) : null,
    percent:
      day.status === 'future' || day.status === 'before-start' || binary
        ? null
        : `${formatNumber(Math.round(day.ratio * 100))}%`,
    note: day.note,
  }
}

export function ariaLabelForDay(day: DayEvaluation): string {
  const d = describeDay(day)
  return [formatDateLong(day.date), d.status, d.progress, d.percent && `${d.percent} of target`, d.note && `Note: ${d.note}`]
    .filter(Boolean)
    .join('. ')
}
