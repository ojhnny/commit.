import { useLayoutEffect, useRef, useState } from 'react'
import type { DayEvaluation } from '@/domain/types'
import { describeDay } from './describe'
import { StatusDot } from './StatusDot'

/** Floating tooltip for a hovered/focused heatmap cell. Positioned above the cell, flipped/clamped to the viewport. */
export function HeatmapTooltip({ day, anchor }: { day: DayEvaluation; anchor: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const d = describeDay(day)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const margin = 8
    let left = anchor.left + anchor.width / 2 - width / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
    let top = anchor.top - height - 8
    if (top < margin) top = anchor.bottom + 8
    setPos({ left, top })
  }, [anchor, day])

  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-50 w-max max-w-[260px] rounded-md border border-border bg-surface-3 px-3 py-2 text-small shadow-[0_8px_24px_rgb(0_0_0/0.4)]"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      <div className="font-medium text-text">{d.date}</div>
      <div className="mt-1 flex items-center gap-1.5 text-text-muted">
        <StatusDot status={day.status} />
        <span>{d.status}</span>
        {d.percent ? <span className="tabular ml-auto pl-3 text-text">{d.percent}</span> : null}
      </div>
      {d.progress ? (
        <div className="tabular mt-0.5 text-text">{d.progress}</div>
      ) : null}
      {d.target && day.status !== 'future' ? <div className="tabular text-text-muted">Target: {d.target}</div> : null}
      {d.note ? <div className="mt-1.5 border-t border-border pt-1.5 text-text-muted italic">“{d.note}”</div> : null}
    </div>
  )
}
