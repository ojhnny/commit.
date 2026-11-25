import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  label: string
  className?: string
  size?: 'sm' | 'md'
}

/** Single-select toggle group (radio semantics). */
export function Segmented<T extends string>({ value, onChange, options, label, className, size = 'md' }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex rounded-md border border-border bg-surface-2 p-0.5', className)}
      onKeyDown={(e) => {
        const i = options.findIndex((o) => o.value === value)
        const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
        if (!dir) return
        e.preventDefault()
        const next = options[(i + dir + options.length) % options.length]
        if (next) {
          onChange(next.value)
          const el = e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)
          el?.focus()
        }
      }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-value={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-[5px] px-3 font-medium whitespace-nowrap transition-colors duration-150',
              size === 'sm' ? 'h-7 text-small touch:h-9' : 'h-8 text-body touch:h-10',
              active ? 'bg-surface-3 text-text shadow-[0_0_0_1px_var(--color-border)]' : 'text-text-muted hover:text-text',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
