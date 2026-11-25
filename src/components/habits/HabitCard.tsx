import { ArrowDown, ArrowUp, Check, ChevronRight, Plus } from 'lucide-react'
import { memo, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatPercent } from '@/domain/consistency'
import { recentDays, type LogIndex } from '@/domain/progress'
import { currentGoal, describeSchedule } from '@/domain/scheduling'
import { computeHabitStats } from '@/domain/stats'
import type { DateKey, Habit } from '@/domain/types'
import { formatNumber, formatProgress, formatTarget, isBinary } from '@/domain/units'
import { Button } from '@/components/ui/button'
import { StatusDot } from '@/components/heatmap/StatusDot'
import { WeekPreview } from '@/components/heatmap/WeekPreview'
import { useStore } from '@/state/HabitStore'
import { cn } from '@/lib/utils'
import { ColorDot } from './ColorPicker'
import { TimerChip } from './HabitTimer'

interface HabitCardProps {
  habit: Habit
  logs: LogIndex
  today: DateKey
  onQuickLog: (habit: Habit) => void
  reorder?: { onUp?: () => void; onDown?: () => void }
  /** Drag grip shown in the top-right corner instead of the chevron. */
  dragHandle?: ReactNode
}

function todayLabel(habit: Habit, status: string, value: number, today: DateKey): string {
  const goal = currentGoal(habit, today)
  if (status === 'before-start') return 'Starts later'
  if (status === 'rest') return 'Rest day'
  if (isBinary(goal)) return status === 'done' || status === 'exceeded' ? 'Done today' : 'Not done today'
  if (status === 'pending') return 'Not logged today'
  return `${formatProgress(goal, value)} today`
}

/**
 * Dashboard card. The whole card navigates to the habit (stretched link);
 * the quick-log control sits above the link layer so it stays independently clickable.
 */
export const HabitCard = memo(function HabitCard({ habit, logs, today, onQuickLog, reorder, dragHandle }: HabitCardProps) {
  const { actions } = useStore()
  const goal = currentGoal(habit, today)
  const binary = isBinary(goal)
  const stats = useMemo(() => computeHabitStats(habit, logs, today), [habit, logs, today])
  const week = useMemo(() => recentDays(habit, logs, today, 7), [habit, logs, today])
  const t = stats.today
  const complete = t.status === 'done' || t.status === 'exceeded'
  // Rest days stay quiet on the dashboard; extra effort can still be logged from the habit page.
  const canLogToday = habit.startDate <= today && (t.scheduled || t.value > 0)
  const archived = habit.archivedAt !== null

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-colors duration-150 hover:border-[#3d4048] hover:bg-[#191b1f]',
        'has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-green',
        archived && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-[15px] leading-5 font-medium text-text">
            <ColorDot color={habit.color} />
            <Link to={`/habits/${habit.id}`} className="truncate outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']">
              {habit.name}
            </Link>
          </h2>
          <p className="mt-0.5 truncate text-small text-text-muted">
            {formatTarget(goal)} · {describeSchedule(goal.schedule)}
          </p>
        </div>
        {reorder ? (
          <div className="relative z-10 -mt-1 -mr-1 flex gap-0.5">
            <Button variant="ghost" size="icon-sm" aria-label={`Move ${habit.name} up`} disabled={!reorder.onUp} onClick={reorder.onUp}>
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Move ${habit.name} down`} disabled={!reorder.onDown} onClick={reorder.onDown}>
              <ArrowDown />
            </Button>
          </div>
        ) : dragHandle ? (
          <div className="-mt-1.5 -mr-2">{dragHandle}</div>
        ) : (
          <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-text-muted" />
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <WeekPreview days={week} today={today} />
        <dl className="flex items-end gap-4 text-right">
          <div className="hidden flex-col-reverse min-[360px]:flex">
            <dt className="text-micro text-text-muted">streak</dt>
            <dd className="tabular text-[18px] leading-6 font-medium tracking-tight text-text">{stats.current}</dd>
          </div>
          <div className="flex flex-col-reverse">
            <dt className="text-micro text-text-muted">consistency</dt>
            <dd className="tabular text-[18px] leading-6 font-medium tracking-tight text-text">{formatPercent(stats.consistency)}</dd>
          </div>
        </dl>
      </div>

      <div className="flex min-h-9 items-center justify-between gap-3 border-t border-border-subtle pt-3 touch:min-h-11">
        <div className="flex min-w-0 items-center gap-2 text-small text-text-muted">
          <StatusDot status={t.status} />
          <span className="tabular truncate">{todayLabel(habit, t.status, t.value, today)}</span>
          <TimerChip habitId={habit.id} />
        </div>
        {!archived && canLogToday && (
          <div className="relative z-10 shrink-0">
            {binary ? (
              <Button
                size="sm"
                variant={complete ? 'accent' : 'secondary'}
                aria-pressed={complete}
                aria-label={complete ? `Undo ${habit.name} for today` : `Mark ${habit.name} done for today`}
                onClick={async () => {
                  await actions.logWithUndo(
                    habit.id,
                    today,
                    { value: complete ? 0 : 1, note: logs.get(today)?.note },
                    complete ? `${habit.name}: marked not done` : `${habit.name}: done for today`,
                  )
                }}
              >
                <Check /> {complete ? 'Done' : 'Mark done'}
              </Button>
            ) : (
              <Button size="sm" variant={complete ? 'ghost' : 'secondary'} aria-label={`Log ${habit.name} for today`} onClick={() => onQuickLog(habit)}>
                <Plus /> Log
                {complete && t.value > goal.targetValue ? <span className="sr-only"> (over target by {formatNumber(t.value - goal.targetValue)})</span> : null}
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  )
})
