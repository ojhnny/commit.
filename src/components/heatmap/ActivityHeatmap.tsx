import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { addDays, endOfYear, parts, startOfYear } from '@/domain/dates'
import { buildYearGrid } from '@/domain/heatmap'
import { evaluateDay, type LogIndex } from '@/domain/progress'
import type { DateKey, DayEvaluation, Habit } from '@/domain/types'
import { cn } from '@/lib/utils'
import { ariaLabelForDay } from './describe'
import { heatBg } from './heat'
import { HeatmapTooltip } from './HeatmapTooltip'

interface ActivityHeatmapProps {
  habit: Habit
  logs: LogIndex
  today: DateKey
  year: number
  onSelectDate: (date: DateKey) => void
}

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
/** Room for a month label that starts in one of the last columns (e.g. "Dec"). */
const LABEL_OVERHANG = 12
const MAX_CELL = 16

/**
 * Grows cells to fill wide containers (desktop) while never shrinking below the
 * CSS minimum (13px touch, 11px mouse); narrower containers scroll instead.
 */
function useFluidCellSize(ref: RefObject<HTMLDivElement | null>, columns: number): number | null {
  const [size, setSize] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const styles = getComputedStyle(el)
      const min = parseFloat(styles.getPropertyValue('--cell-min')) || 11
      const gap = parseFloat(styles.getPropertyValue('--cell-gap')) || 3
      const fit = Math.floor((el.clientWidth - LABEL_OVERHANG - (columns - 1) * gap) / columns)
      setSize(Math.max(min, Math.min(MAX_CELL, fit)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, columns])
  return size
}

/**
 * GitHub-style contribution calendar for one habit and one calendar year.
 *
 * - DOM is row-major (7 role="row" rows) so it reads as a proper ARIA grid;
 *   visually each column is one week starting Sunday.
 * - One tab stop; arrow keys move by day (↑↓) and week (←→).
 * - Mouse hover shows a shared tooltip. Click / tap / Enter opens the day.
 * - Scrolls horizontally *inside* the panel on narrow screens, starting at today.
 */
export const ActivityHeatmap = memo(function ActivityHeatmap({ habit, logs, today, year, onSelectDate }: ActivityHeatmapProps) {
  const grid = useMemo(() => buildYearGrid(year), [year])
  const days = useMemo(() => {
    const map = new Map<DateKey, DayEvaluation>()
    for (const week of grid.weeks) for (const d of week) if (d) map.set(d, evaluateDay(habit, logs.get(d), d, today))
    return map
  }, [grid, habit, logs, today])

  const todayInYear = parts(today).year === year
  const [focusDate, setFocusDate] = useState<DateKey>(todayInYear ? today : endOfYear(year) < today ? endOfYear(year) : startOfYear(year))
  const [tooltip, setTooltip] = useState<{ date: DateKey; rect: DOMRect } | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const columns = grid.weeks.length
  const cell = useFluidCellSize(scrollerRef, columns)

  // Reset focus target and scroll position when the year changes.
  useLayoutEffect(() => {
    const target = todayInYear ? today : endOfYear(year) < today ? endOfYear(year) : startOfYear(year)
    setFocusDate(target)
    const scroller = scrollerRef.current
    if (!scroller) return
    const col = grid.weeks.findIndex((w) => w.includes(target))
    const step = scroller.scrollWidth / grid.weeks.length
    scroller.scrollLeft = Math.max(0, (col + 2) * step - scroller.clientWidth)
  }, [year, today, todayInYear, grid, cell])

  const moveFocus = (delta: number) => {
    const next = addDays(focusDate, delta)
    if (parts(next).year !== year) return
    setFocusDate(next)
    requestAnimationFrame(() => {
      const el = gridRef.current?.querySelector<HTMLElement>(`[data-date="${next}"]`)
      el?.focus()
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }
    const delta = keys[e.key]
    if (delta !== undefined) {
      e.preventDefault()
      moveFocus(delta)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelectDate(focusDate)
    }
  }

  const tooltipDay = tooltip ? days.get(tooltip.date) : undefined

  return (
    <div className="flex min-w-0 gap-2" style={cell ? ({ '--cell': `${cell}px` } as CSSProperties) : undefined}>
      {/* Weekday labels stay fixed while the grid scrolls. */}
      <div aria-hidden className="flex shrink-0 flex-col gap-[var(--cell-gap)] pt-[18px] text-micro text-text-muted">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="flex h-[var(--cell)] items-center leading-none">
            {label}
          </div>
        ))}
      </div>

      <div ref={scrollerRef} className="scrollbar-thin min-w-0 flex-1 overflow-x-auto overscroll-x-contain pb-2">
        <div
          className="relative"
          style={{ width: `calc(${columns} * var(--cell) + ${columns - 1} * var(--cell-gap) + ${LABEL_OVERHANG}px)` }}
        >
          <div aria-hidden className="relative h-[18px] text-micro text-text-muted">
            {grid.months.map((m) => (
              <span
                key={m.month}
                className="absolute top-0 leading-[14px]"
                style={{ left: `calc(${m.column} * (var(--cell) + var(--cell-gap)))` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div
            ref={gridRef}
            role="grid"
            aria-label={`${habit.name} activity in ${year}. Use arrow keys to move between days and Enter to open one.`}
            className="flex flex-col gap-[var(--cell-gap)]"
            onKeyDown={onKeyDown}
            onPointerLeave={() => setTooltip(null)}
          >
            {Array.from({ length: 7 }, (_, row) => (
              <div role="row" key={row} className="flex gap-[var(--cell-gap)]">
                {grid.weeks.map((week, col) => {
                  const date = week[row]
                  if (!date) return <div key={col} role="presentation" className="size-[var(--cell)] shrink-0" />
                  const day = days.get(date)!
                  const isToday = date === today
                  return (
                    <div
                      key={col}
                      role="gridcell"
                      data-date={date}
                      tabIndex={date === focusDate ? 0 : -1}
                      aria-label={ariaLabelForDay(day)}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => {
                        setFocusDate(date)
                        onSelectDate(date)
                      }}
                      onPointerEnter={(e) => {
                        if (e.pointerType === 'mouse') setTooltip({ date, rect: e.currentTarget.getBoundingClientRect() })
                      }}
                      onFocus={(e) => {
                        setFocusDate(date)
                        if (e.currentTarget.matches(':focus-visible'))
                          setTooltip({ date, rect: e.currentTarget.getBoundingClientRect() })
                      }}
                      onBlur={() => setTooltip(null)}
                      className={cn(
                        'size-[var(--cell)] shrink-0 cursor-pointer rounded-cell transition-[filter] duration-100 hover:brightness-125 focus-visible:outline-offset-1',
                        heatBg(day.status),
                        isToday && 'ring-1 ring-text-muted ring-offset-1 ring-offset-surface',
                        day.status === 'future' && 'opacity-50',
                      )}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {tooltip && tooltipDay
        ? createPortal(<HeatmapTooltip day={tooltipDay} anchor={tooltip.rect} />, document.body)
        : null}
    </div>
  )
})
