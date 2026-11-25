import { cn } from '@/lib/utils'
import { HEAT_BG } from './heat'

const ITEMS = [
  { level: 'empty', label: 'No goal' },
  { level: 'missed', label: 'Missed' },
  { level: 'partial', label: 'Partial' },
  { level: 'done', label: 'Done' },
  { level: 'exceeded', label: 'Exceeded' },
] as const

export function HeatmapLegend({ className }: { className?: string }) {
  return (
    <ul aria-label="Legend" className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-text-muted', className)}>
      {ITEMS.map((item) => (
        <li key={item.level} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('size-[10px] rounded-cell', HEAT_BG[item.level])} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
