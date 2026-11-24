import type { DayStatus } from '@/domain/types'
import { cn } from '@/lib/utils'
import { heatBg } from './heat'

/** Small colored square that always accompanies a text label (never used alone). */
export function StatusDot({ status, className }: { status: DayStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2 shrink-0 rounded-[2px]',
        heatBg(status),
        (status === 'pending' || status === 'rest') && 'bg-transparent ring-1 ring-text-faint ring-inset',
        className,
      )}
    />
  )
}
