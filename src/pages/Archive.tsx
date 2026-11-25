import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { formatPercent } from '@/domain/consistency'
import { formatDateMedium, toDateKey } from '@/domain/dates'
import { computeHabitStats } from '@/domain/stats'
import { formatHours, habitTime, isTimeBased } from '@/domain/time'
import type { DateKey, Habit, HabitLog } from '@/domain/types'
import { ColorDot } from '@/components/habits/ColorPicker'
import { Page } from '@/components/layout/Page'
import { EmptyState, ErrorView, LoadingView } from '@/components/layout/StateViews'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useStore } from '@/state/HabitStore'

const EMPTY: ReadonlyMap<DateKey, HabitLog> = new Map()

/** Range like "Mar 3 – Sep 18, 2026" (year shown once when both dates share it). */
function formatRange(from: DateKey, to: DateKey): string {
  const a = formatDateMedium(from).replace(/^\w+, /, '')
  const b = formatDateMedium(to).replace(/^\w+, /, '')
  return from.slice(0, 4) === to.slice(0, 4) ? `${a.replace(/,\s\d{4}$/, '')} – ${b}` : `${a} – ${b}`
}

/** Archived habits with Restore and permanent Delete (DESIGN.md §8 Archive page). */
export function Archive() {
  const { status, habits, logsByHabit, notesByHabit, today, actions } = useStore()
  const [deleting, setDeleting] = useState<Habit | null>(null)
  const archived = useMemo(
    () => habits.filter((h) => h.archivedAt !== null).sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [habits],
  )

  const rows = useMemo(
    () =>
      archived.map((habit) => {
        const logs = logsByHabit.get(habit.id) ?? EMPTY
        const end = (() => {
          const d = toDateKey(new Date(habit.archivedAt!))
          return d < today ? d : today
        })()
        const stats = computeHabitStats(habit, logs, end < habit.startDate ? habit.startDate : end)
        const parts = [
          formatRange(habit.startDate, end < habit.startDate ? habit.startDate : end),
          `${stats.completedDays} ${stats.completedDays === 1 ? 'day' : 'days'} completed`,
          `${formatPercent(stats.consistency)} consistency`,
        ]
        if (isTimeBased(habit)) parts.push(formatHours(habitTime(habit, logs.values(), today).total))
        const notes = notesByHabit.get(habit.id)?.length ?? 0
        if (notes) parts.push(`${notes} ${notes === 1 ? 'note' : 'notes'}`)
        return { habit, line: parts.join(' · '), completed: stats.completedDays, notes }
      }),
    [archived, logsByHabit, notesByHabit, today],
  )

  if (status === 'loading') return <LoadingView />
  if (status === 'error') return <ErrorView />

  const pending = rows.find((r) => r.habit.id === deleting?.id)

  return (
    <>
      <header className="pt-safe sticky top-0 z-30 border-b border-border-subtle bg-bg/95 backdrop-blur-[2px]">
        <div className="mx-auto flex h-14 w-full max-w-[1040px] items-center gap-2 px-2 sm:px-4 lg:px-6">
          <Button asChild variant="ghost" className="px-2 sm:px-3">
            <Link to="/" aria-label="Back to all habits">
              <ArrowLeft />
              <span className="max-sm:sr-only">Habits</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1 truncate text-center text-body font-medium sm:hidden" aria-hidden>
            Archive
          </div>
          <div className="size-9 sm:hidden" />
        </div>
      </header>

      <Page className="flex flex-col gap-4 pt-5 sm:gap-6 sm:pt-6">
        <div>
          <h1 className="text-[18px] leading-7 font-semibold tracking-[-0.01em] text-text sm:text-title">Archive</h1>
          <p className="mt-0.5 text-body text-text-muted">Habits you've finished or put away. Their history is kept until you delete them.</p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="Nothing archived"
            body="Archive a habit from its ⋯ menu to keep its history without it on your dashboard."
            action={
              <Button asChild variant="primary">
                <Link to="/">Back to habits</Link>
              </Button>
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {rows.map(({ habit, line }, i) => (
              <li
                key={habit.id}
                className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5 ${i ? 'border-t border-border-subtle' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ColorDot color={habit.color} />
                    <Link to={`/habits/${habit.id}`} className="truncate text-body font-medium text-text underline-offset-4 hover:underline">
                      {habit.name}
                    </Link>
                  </div>
                  <p className="tabular mt-1 text-small text-text-muted">{line}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="max-sm:flex-1"
                    onClick={async () => {
                      await actions.restoreHabit(habit.id)
                      toast(`${habit.name} restored`)
                    }}
                  >
                    Restore
                  </Button>
                  <Button size="sm" variant="danger-ghost" className="max-sm:flex-1" onClick={() => setDeleting(habit)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && <p className="text-micro text-text-faint">Archived habits still count toward your time totals on the dashboard.</p>}
      </Page>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'habit'}?`}
        description={
          pending
            ? `This permanently deletes the habit and its ${pending.completed === 1 ? '1 completed day' : `${pending.completed} completed days`} of history${
                pending.notes ? `, including ${pending.notes === 1 ? 'its note' : `its ${pending.notes} notes`}` : ''
              }. This can't be undone.`
            : ''
        }
        confirmLabel="Delete forever"
        onConfirm={async () => {
          if (!deleting) return
          const name = deleting.name
          const ok = await actions.deleteHabit(deleting.id)
          setDeleting(null)
          if (ok) toast(`${name} deleted`)
        }}
      />
    </>
  )
}
