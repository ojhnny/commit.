import { canTime } from '@/domain/timer'
import { ColorDot } from '@/components/habits/ColorPicker'
import { HabitTimer } from '@/components/habits/HabitTimer'
import { Archive, ArchiveRestore, ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, MoreHorizontal, NotebookText, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useMatch, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { formatDateMedium, parts } from '@/domain/dates'
import { currentGoal, describeSchedule } from '@/domain/scheduling'
import { computeHabitStats } from '@/domain/stats'
import { evaluateRange, isComplete } from '@/domain/progress'
import type { DateKey } from '@/domain/types'
import { formatTarget } from '@/domain/units'
import { formatHours, habitTime, isTimeBased, toHours } from '@/domain/time'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Segmented } from '@/components/ui/segmented'
import { ActivityHeatmap } from '@/components/heatmap/ActivityHeatmap'
import { HeatmapLegend } from '@/components/heatmap/HeatmapLegend'
import { MonthlyCalendar } from '@/components/heatmap/MonthlyCalendar'
import { DaySheet } from '@/components/habits/DaySheet'
import { HabitFormDialog } from '@/components/habits/HabitFormDialog'
import { HabitStatistics } from '@/components/habits/HabitStatistics'
import { ProgressLogger } from '@/components/habits/ProgressLogger'
import { Page, Section } from '@/components/layout/Page'
import { EmptyState, ErrorView, LoadingView } from '@/components/layout/StateViews'
import { NoteEditor } from '@/components/notes/NoteEditor'
import { NotesList } from '@/components/notes/NotesList'
import { useHabitLogs, useHabitNotes, useStore } from '@/state/HabitStore'

type View = 'year' | 'month'

/**
 * One reusable page for every habit, populated from the `:habitId` route param.
 * All state derives from that habit's own logs, so switching habits never
 * touches another habit's history.
 */
export function HabitDetails() {
  const { habitId } = useParams()
  const { status, habits, today } = useStore()
  const habit = habits.find((h) => h.id === habitId)

  if (status === 'loading') return <LoadingView />
  if (status === 'error') return <ErrorView />
  if (!habit) {
    return (
      <Page className="pt-10">
        <EmptyState
          title="Habit not found"
          body="It may have been deleted, or the link is from another browser. Prototype data isn't shared between devices."
          action={
            <Button asChild variant="primary">
              <Link to="/">Back to habits</Link>
            </Button>
          }
        />
      </Page>
    )
  }
  // Keyed so local UI state (selected year, open sheets) resets per habit.
  return <HabitDetailsView key={habit.id} habitId={habit.id} today={today} />
}

function HabitDetailsView({ habitId, today }: { habitId: string; today: DateKey }) {
  const { habits, actions } = useStore()
  const habit = habits.find((h) => h.id === habitId)!
  const logs = useHabitLogs(habit.id)
  const notes = useHabitNotes(habit.id)
  const navigate = useNavigate()
  const { noteId } = useParams()
  const notesView = useMatch('/habits/:habitId/notes/*') !== null
  const openNoteId = noteId ? actions.resolveNoteId(noteId) : undefined
  const openNote = openNoteId ? notes.find((n) => n.id === openNoteId) : undefined
  const viewSuffix = notesView ? '/notes' : ''

  const todayParts = parts(today)
  const [view, setView] = useState<View>('year')
  const [year, setYear] = useState(todayParts.year)
  const [month, setMonth] = useState({ year: todayParts.year, month: todayParts.month })
  const [selected, setSelected] = useState<DateKey | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const stats = useMemo(() => computeHabitStats(habit, logs, today), [habit, logs, today])
  const time = useMemo(() => {
    if (!isTimeBased(habit)) return undefined
    const day = stats.today
    return {
      totals: habitTime(habit, logs.values(), today),
      todayHint: !day.scheduled ? 'Rest day' : (() => {
        const goal = toHours(day.goal.unit, day.goal.targetValue)
        return goal === null ? 'Not timed today' : `of ${formatHours(goal)} goal`
      })(),
      startDate: habit.startDate,
    }
  }, [habit, logs, today, stats])
  // GitHub-style headline: completed scheduled days in the selected year.
  const yearCompleted = useMemo(() => {
    const from = `${year}-01-01` > habit.startDate ? `${year}-01-01` : habit.startDate
    const to = `${year}-12-31` < today ? `${year}-12-31` : today
    if (from > to) return 0
    return evaluateRange(habit, logs, from, to, today).filter((d) => d.scheduled && isComplete(d.status)).length
  }, [habit, logs, today, year])

  // Quick switching between habits in dashboard order.
  const siblings = habits.filter((h) => (h.archivedAt === null) === (habit.archivedAt === null))
  const index = siblings.findIndex((h) => h.id === habit.id)
  const prev = siblings[index - 1]
  const next = siblings[index + 1]
  const goal = currentGoal(habit, today)
  const firstYear = Math.min(parts(habit.startDate).year, todayParts.year)
  const archived = habit.archivedAt !== null
  const started = habit.startDate <= today

  const archive = async () => {
    await actions.archiveHabit(habit.id)
    toast(`${habit.name} archived`, {
      description: 'History is kept. Restore it any time.',
      action: { label: 'Undo', onClick: () => void actions.restoreHabit(habit.id) },
    })
  }

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
            {habit.name}
          </div>
          <div className="flex-1 max-sm:hidden" />
          <nav aria-label="Switch habit" className="flex items-center max-[379px]:hidden">
            <Button variant="ghost" size="icon" aria-label={prev ? `Previous habit: ${prev.name}` : 'No previous habit'} disabled={!prev} onClick={() => prev && navigate(`/habits/${prev.id}${viewSuffix}`)}>
              <ChevronUp />
            </Button>
            <Button variant="ghost" size="icon" aria-label={next ? `Next habit: ${next.name}` : 'No next habit'} disabled={!next} onClick={() => next && navigate(`/habits/${next.id}${viewSuffix}`)}>
              <ChevronDown />
            </Button>
          </nav>
          <Button
            variant="ghost"
            aria-pressed={notesView}
            aria-label={`Notes (${notes.length})`}
            onClick={() => navigate(notesView ? `/habits/${habit.id}` : `/habits/${habit.id}/notes`)}
            className="px-2.5 aria-pressed:bg-surface-3 aria-pressed:text-text"
          >
            <NotebookText />
            <span className="max-sm:sr-only">Notes</span>
            {notes.length > 0 && (
              <span aria-hidden className="tabular text-text-faint">
                {notes.length}
              </span>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Habit options">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Edit habit
              </DropdownMenuItem>
              {archived ? (
                <DropdownMenuItem
                  onSelect={async () => {
                    await actions.restoreHabit(habit.id)
                    toast(`${habit.name} restored`)
                  }}
                >
                  <ArchiveRestore /> Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={archive}>
                  <Archive /> Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete permanently…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Page className="flex flex-col gap-4 pt-5 sm:gap-6 sm:pt-6">
        {archived && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3 text-small text-text-muted">
            <span>This habit is archived. Its history is kept but it's hidden from your dashboard.</span>
            <Button size="sm" onClick={() => void actions.restoreHabit(habit.id)}>
              <ArchiveRestore /> Restore
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-[18px] leading-7 font-semibold tracking-[-0.01em] text-text sm:text-title">
            <ColorDot color={habit.color} className="size-2.5" />
            <span className="min-w-0">{habit.name}</span>
          </h1>
          <p className="tabular mt-0.5 text-body text-text-muted">
            {formatTarget(goal)} · {describeSchedule(goal.schedule)} · since {formatDateMedium(habit.startDate).replace(/^\w+, /, '')}
          </p>
          {habit.description && <p className="mt-2 max-w-[640px] text-body text-text-muted">{habit.description}</p>}
        </div>
        {!archived && started && canTime(goal) && <HabitTimer habit={habit} todayLog={logs.get(today)} />}
        </div>

        {notesView ? (
          noteId ? (
            openNote ? (
              <NoteEditor habit={habit} note={openNote} />
            ) : (
              <EmptyState
                title="Note not found"
                body="It may have been deleted, or renamed on another device."
                action={
                  <Button asChild>
                    <Link to={`/habits/${habit.id}/notes`}>All notes</Link>
                  </Button>
                }
              />
            )
          ) : (
            <NotesList habit={habit} notes={notes} />
          )
        ) : (
          <>
            <HabitStatistics stats={stats} time={time} />

            <Section
              id="activity-heading"
              title={
                <>
                  Activity
                  <span className="tabular ml-2 font-normal text-text-muted">
                    {yearCompleted} {yearCompleted === 1 ? 'day' : 'days'} completed in {year}
                  </span>
                </>
              }
              actions={
                <div className="flex items-center gap-2">
                  {view === 'year' && (
                    <div className="flex items-center" role="group" aria-label="Year">
                      <Button variant="ghost" size="icon-sm" aria-label="Previous year" disabled={year <= firstYear} onClick={() => setYear((y) => y - 1)}>
                        <ChevronLeft />
                      </Button>
                      <span className="tabular w-11 text-center text-body font-medium" aria-live="polite">
                        {year}
                      </span>
                      <Button variant="ghost" size="icon-sm" aria-label="Next year" disabled={year >= todayParts.year} onClick={() => setYear((y) => y + 1)}>
                        <ChevronRight />
                      </Button>
                    </div>
                  )}
                  <Segmented<View>
                    size="sm"
                    label="Calendar view"
                    value={view}
                    onChange={setView}
                    options={[
                      { value: 'year', label: 'Year' },
                      { value: 'month', label: 'Month' },
                    ]}
                  />
                </div>
              }
            >
              {view === 'year' ? (
                <ActivityHeatmap habit={habit} logs={logs} today={today} year={year} onSelectDate={setSelected} />
              ) : (
                <MonthlyCalendar
                  habit={habit}
                  logs={logs}
                  today={today}
                  year={month.year}
                  month={month.month}
                  onMonthChange={(y, m) => setMonth({ year: y, month: m })}
                  onSelectDate={setSelected}
                />
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-micro text-text-faint">
                  {view === 'year' ? 'Select a day to see details or edit it.' : 'Tap a day to see details or edit it.'}
                </p>
                <HeatmapLegend />
              </div>
            </Section>

            <Section id="today-heading" title={`Today · ${formatDateMedium(today).replace(/,\s\d{4}$/, '')}`}>
                {archived ? (
                  <p className="text-small text-text-muted">Restore this habit to log progress.</p>
                ) : started ? (
                  <ProgressLogger habit={habit} date={today} log={logs.get(today)} layout="wide" />
                ) : (
                  <p className="text-small text-text-muted">This habit starts on {formatDateMedium(habit.startDate)}.</p>
                )}
            </Section>
          </>
        )}
      </Page>

      <DaySheet habit={habit} date={selected} onClose={() => setSelected(null)} />
      <HabitFormDialog open={editing} onOpenChange={setEditing} habit={habit} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${habit.name}?`}
        description={`This permanently deletes the habit and its entire history${notes.length ? `, including ${notes.length === 1 ? 'its note' : `its ${notes.length} notes`}` : ''}. If you just want it off your dashboard, archive it instead.`}
        confirmLabel="Delete habit"
        onConfirm={async () => {
          const ok = await actions.deleteHabit(habit.id)
          if (ok) {
            toast(`${habit.name} deleted`)
            navigate('/')
          }
        }}
      />
    </>
  )
}
