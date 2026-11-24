import { formatPercent } from '@/domain/consistency'
import type { HabitStats } from '@/domain/stats'

/** Compact stat strip — plain text with dividers, not oversized cards (DESIGN.md §9). */
export function HabitStatistics({ stats }: { stats: HabitStats }) {
  const items = [
    {
      label: 'Consistency',
      value: formatPercent(stats.consistency),
      hint:
        stats.consistency === null
          ? 'No completed days to measure yet'
          : `${stats.completedDays} of ${stats.eligibleDays} scheduled days`,
    },
    { label: 'Current streak', value: `${stats.current}`, unit: stats.current === 1 ? 'day' : 'days', hint: stats.current ? 'Scheduled days in a row' : 'Complete today to start one' },
    { label: 'Longest streak', value: `${stats.longest}`, unit: stats.longest === 1 ? 'day' : 'days', hint: 'Best run so far' },
    {
      label: 'Completed days',
      value: `${stats.completedDays}`,
      hint: stats.partialDays ? `+ ${stats.partialDays} partial` : stats.missedDays ? `${stats.missedDays} missed` : 'Target reached',
    },
  ]
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 bg-surface px-4 py-3">
          <dt className="text-small text-text-muted">{item.label}</dt>
          <dd className="tabular text-[20px] leading-6 font-medium tracking-tight text-text">
            {item.value}
            {item.unit && <span className="ml-1 text-small font-normal text-text-muted">{item.unit}</span>}
          </dd>
          <dd className="tabular line-clamp-2 text-micro text-text-faint">{item.hint}</dd>
        </div>
      ))}
    </dl>
  )
}
