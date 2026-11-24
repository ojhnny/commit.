import { heat, type HeatLevel } from '@/design/tokens'

interface ProgressBarProps {
  ratio: number
  level: HeatLevel
  label: string
}

export function ProgressBar({ ratio, level, label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(ratio, 1) * 100)}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%`, background: level === 'empty' ? 'transparent' : heat[level] }}
      />
    </div>
  )
}
