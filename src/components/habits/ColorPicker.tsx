import { Ban } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'
import { HABIT_COLORS } from '@/domain/colors'
import type { HabitColor } from '@/domain/types'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  value: HabitColor | undefined
  onChange: (value: HabitColor | undefined) => void
  labelledBy: string
}

const OPTIONS: { id: HabitColor | undefined; name: string; hex?: string }[] = [{ id: undefined, name: 'None' }, ...HABIT_COLORS]

/** Radio group of nine swatches (None + eight colors). Arrow keys move the selection, like native radios. */
export function ColorPicker({ value, onChange, labelledBy }: ColorPickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selected = Math.max(0, OPTIONS.findIndex((o) => o.id === value))

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (selected + step + OPTIONS.length) % OPTIONS.length
    onChange(OPTIONS[next]!.id)
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2" onKeyDown={onKeyDown}>
      {OPTIONS.map((o, i) => {
        const checked = i === selected
        return (
          <button
            key={o.name}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.name}
            title={o.name}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.id)}
            className={cn(
              'flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-shadow touch:size-9',
              checked ? 'ring-2 ring-text' : 'hover:ring-2 hover:ring-border',
              !o.hex && 'border border-border text-text-faint',
            )}
            style={o.hex ? { background: o.hex } : undefined}
          >
            {!o.hex && <Ban className="size-3.5" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

/** The 8px dot shown before a habit's name. Renders nothing for habits without a color. */
export function ColorDot({ color, className }: { color: string | undefined; className?: string }) {
  const hex = HABIT_COLORS.find((c) => c.id === color)?.hex
  if (!hex) return null
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: hex }} />
}
