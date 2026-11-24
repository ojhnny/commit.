import { ArrowDown, ArrowRight, ArrowUp, ChevronDown } from 'lucide-react'
import { memo, useId, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { formatPercent } from '@/domain/consistency'
import { recentDays, type LogIndex } from '@/domain/progress'
import { currentGoal, describeSchedule } from '@/domain/scheduling'
import { computeHabitStats } from '@/domain/stats'
import type { DateKey, Habit } from '@/domain/types'
import { formatProgress, formatTarget, isBinary } from '@/domain/units'
import { Button } from '@/components/ui/button'
import { MiniHeatmap } from '@/components/heatmap/MiniHeatmap'
import { StatusDot } from '@/components/heatmap/StatusDot'
import { WeekPreview } from '@/components/heatmap/WeekPreview'
import { describeDay } from '@/components/heatmap/describe'
import { cn } from '@/lib/utils'
import { ProgressLogger } from './ProgressLogger'

interface HabitRowProps {
  habit: Habit
  logs: LogIndex
  today: DateKey
  expanded: boolean
  onToggle: () => void
  reorder?: { onUp?: () => void; onDown?: () => void }
}

function shortToday(habit: Habit, status: string, value: number, today: DateKey): string {
  const goal = currentGoal(habit, today)
  if (status === 'before-start') return 'Starts later'
  if (status === 'rest') return 'Rest day'
  if (status === 'pending') return 'Not logged'
  if (isBinary(goal)) return status === 'done' || status === 'exceeded' ? 'Done' : 'Not done'
  return formatProgress(goal, value)
}

/**
 * Collapsible list row (dashboard "List" view). Collapsed: one scannable line.
 * Expanded: recent weeks, stats and today's logger without leaving the dashboard.
 */
export const HabitRow = memo(function HabitRow({ habit, logs, today, expanded, onToggle, reorder }: HabitRowProps) {
  const panelId = useId()
  const goal = currentGoal(habit, today)
  const stats = useMemo(() => computeHabitStats(habit, logs, today), [habit, logs, today])
  const week = useMemo(() => recentDays(habit, logs, today, 7), [habit, logs, today])
  const t = stats.today
  const archived = habit.archivedAt !== null

  return (
    <div className={cn('rounded-lg border border-border bg-surface transition-colors', expanded ? 'border-[#3d4048]' : 'hover:border-[#3d4048]', archived && 'opacity-70')}>
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left sm:px-4"
        >
          <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-text-muted transition-transform duration-150', !expanded && '-rotate-90')} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] leading-5 font-medium text-text">{habit.name}</span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-small text-text-muted">
              <StatusDot status={t.status} />
              <span className="tabular truncate">{shortToday(habit, t.status, t.value, today)}</span>
              <span className="sr-only">. {describeDay(t).status}</span>
            </span>
          </span>
          <span className="hidden sm:block">
            <WeekPreview days={week} today={today} />
          </span>
          <span className="shrink-0 text-right whitespace-nowrap">
            <span className="tabular block text-body font-medium text-text">{formatPercent(stats.consistency)}</span>
            <span className="block text-micro text-text-faint">{stats.current}d streak</span>
          </span>
        </button>
        {reorder && (
          <div className="flex shrink-0 gap-0.5 pr-2">
            <Button variant="ghost" size="icon-sm" aria-label={`Move ${habit.name} up`} disabled={!reorder.onUp} onClick={reorder.onUp}>
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Move ${habit.name} down`} disabled={!reorder.onDown} onClick={reorder.onDown}>
              <ArrowDown />
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div id={panelId} role="region" aria-label={`${habit.name} details`} className="animate-fade-in border-t border-border-subtle px-3 pt-3 pb-4 sm:px-4">
          <div className="grid gap-5 md:grid-cols-2 md:gap-6">
            <div className="flex min-w-0 flex-col gap-3">
              <p className="text-small text-text-muted">
                {formatTarget(goal)} · {describeSchedule(goal.schedule)}
              </p>
              <MiniHeatmap habit={habit} logs={logs} today={today} />
              <dl className="grid grid-cols-4 gap-2 text-small">
                {[
                  ['Consistency', formatPercent(stats.consistency)],
                  ['Streak', `${stats.current}d`],
                  ['Best', `${stats.longest}d`],
                  ['Completed', `${stats.completedDays}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex min-w-0 flex-col-reverse">
                    <dt className="truncate text-micro text-text-faint">{label}</dt>
                    <dd className="tabular text-body font-medium text-text">{value}</dd>
                  </div>
                ))}
              </dl>
              <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
                <Link to={`/habits/${habit.id}`}>
                  Open full history <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="min-w-0">
              {archived ? (
                <p className="text-small text-text-muted">Restore this habit from its page to log progress.</p>
              ) : habit.startDate > today ? (
                <p className="text-small text-text-muted">This habit hasn't started yet.</p>
              ) : (
                <ProgressLogger habit={habit} date={today} log={logs.get(today)} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
