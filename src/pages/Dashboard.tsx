import { Archive, ChevronDown, ChevronsDownUp, ChevronsUpDown, Database, LayoutGrid, List, ListOrdered, MoreHorizontal, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { DateKey, Habit, HabitLog } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HabitCard } from '@/components/habits/HabitCard'
import { HabitRow } from '@/components/habits/HabitRow'
import { TodaySummary } from '@/components/habits/TodaySummary'
import { HabitFormDialog } from '@/components/habits/HabitFormDialog'
import { DaySheet } from '@/components/habits/DaySheet'
import { Wordmark } from '@/components/layout/Wordmark'
import { Page } from '@/components/layout/Page'
import { EmptyState, ErrorView, LoadingView } from '@/components/layout/StateViews'
import { useStore } from '@/state/HabitStore'
import { cn } from '@/lib/utils'

const EMPTY: ReadonlyMap<DateKey, HabitLog> = new Map()

type DashboardView = 'grid' | 'list'
const VIEW_KEY = 'commit-pref:dashboard-view'

function readView(): DashboardView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

function ViewToggle({ value, onChange }: { value: DashboardView; onChange: (v: DashboardView) => void }) {
  const options = [
    { value: 'grid' as const, label: 'Grid view', Icon: LayoutGrid },
    { value: 'list' as const, label: 'List view', Icon: List },
  ]
  return (
    <div role="radiogroup" aria-label="Dashboard layout" className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">
      {options.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={label}
          title={label}
          onClick={() => onChange(v)}
          className={cn(
            'flex size-7 items-center justify-center rounded-[5px] transition-colors touch:size-9',
            value === v ? 'bg-surface-3 text-text shadow-[0_0_0_1px_var(--color-border)]' : 'text-text-muted hover:text-text',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  )
}

export function Dashboard() {
  const { status, habits, logsByHabit, today, actions } = useStore()
  const [creating, setCreating] = useState(false)
  const [quickLog, setQuickLog] = useState<Habit | null>(null)
  const [reordering, setReordering] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [view, setViewState] = useState<DashboardView>(readView)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const setView = (v: DashboardView) => {
    setViewState(v)
    try {
      window.localStorage.setItem(VIEW_KEY, v)
    } catch {
      // Preference just won't be remembered.
    }
  }
  const toggleRow = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // "N" opens the new-habit dialog (ignored while typing or when a dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (document.querySelector('[role=dialog],[role=alertdialog],[role=menu]')) return
      e.preventDefault()
      setCreating(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const active = useMemo(() => habits.filter((h) => h.archivedAt === null), [habits])
  const archived = useMemo(() => habits.filter((h) => h.archivedAt !== null), [habits])
  const hasSample = habits.some((h) => h.isSample)

  if (status === 'loading') return <LoadingView />
  if (status === 'error') return <ErrorView />

  const move = (index: number, delta: number) => {
    const ids = active.map((h) => h.id)
    const [id] = ids.splice(index, 1)
    if (!id) return
    ids.splice(index + delta, 0, id)
    void actions.reorderHabits([...ids, ...archived.map((h) => h.id)])
  }

  return (
    <>
      <header className="pt-safe sticky top-0 z-30 border-b border-border-subtle bg-bg/95 backdrop-blur-[2px] sm:static sm:border-0 sm:bg-transparent">
        <div className="mx-auto flex w-full max-w-[1040px] items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:pt-8 sm:pb-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="leading-none">
              <Wordmark />
            </h1>
            <p className="mt-1 hidden text-small text-text-muted sm:block">Build consistency, one day at a time.</p>
          </div>
          <div className="flex items-center gap-1.5">
            {reordering ? (
              <Button variant="primary" onClick={() => setReordering(false)}>
                Done
              </Button>
            ) : (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Dashboard options">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem disabled={active.length < 2} onSelect={() => setReordering(true)}>
                      <ListOrdered /> Reorder habits
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Prototype data</DropdownMenuLabel>
                    {hasSample ? (
                      <DropdownMenuItem
                        onSelect={async () => {
                          await actions.removeSampleData()
                          toast('Sample habits removed')
                        }}
                      >
                        <Trash2 /> Remove sample habits
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onSelect={async () => {
                          await actions.loadSampleData()
                          toast('Sample habits added')
                        }}
                      >
                        <Database /> Add sample habits
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem destructive onSelect={() => setConfirmReset(true)}>
                      <RotateCcw /> Reset all data…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="primary" onClick={() => setCreating(true)} aria-label="New habit" aria-keyshortcuts="N" title="New habit (N)" className="max-sm:size-11 max-sm:px-0">
                  <Plus />
                  <span className="max-sm:sr-only">New habit</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <Page className="pt-4 sm:pt-0">
        {active.length > 0 && (
          <div className="mb-4 flex items-end justify-between gap-3">
            {reordering ? (
              <p className="text-small text-text-muted">Use the arrows to change the order.</p>
            ) : (
              <TodaySummary habits={active} logsByHabit={logsByHabit} today={today} />
            )}
            <div className="flex shrink-0 items-center gap-1">
              {view === 'list' && !reordering && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={expanded.size ? 'Collapse all' : 'Expand all'}
                  title={expanded.size ? 'Collapse all' : 'Expand all'}
                  onClick={() => setExpanded(expanded.size ? new Set() : new Set(active.map((h) => h.id)))}
                >
                  {expanded.size ? <ChevronsDownUp /> : <ChevronsUpDown />}
                </Button>
              )}
              <ViewToggle value={view} onChange={setView} />
            </div>
          </div>
        )}

        {active.length === 0 ? (
          <EmptyState
            title={archived.length ? 'No active habits' : 'Start your first habit'}
            body={
              archived.length
                ? 'Your archived habits are below. Create a new one or restore an old one.'
                : 'Create a habit, log a little progress each day, and watch your graph fill in.'
            }
            action={
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <Button variant="primary" onClick={() => setCreating(true)}>
                  <Plus /> New habit
                </Button>
                {!hasSample && !archived.length && (
                  <Button variant="ghost" onClick={() => void actions.loadSampleData()}>
                    Explore with sample data
                  </Button>
                )}
              </div>
            }
          />
        ) : view === 'list' ? (
          <ul className="flex flex-col gap-2" aria-label="Habits">
            {active.map((habit, i) => (
              <li key={habit.id}>
                <HabitRow
                  habit={habit}
                  logs={logsByHabit.get(habit.id) ?? EMPTY}
                  today={today}
                  expanded={expanded.has(habit.id)}
                  onToggle={() => toggleRow(habit.id)}
                  reorder={
                    reordering
                      ? { onUp: i > 0 ? () => move(i, -1) : undefined, onDown: i < active.length - 1 ? () => move(i, 1) : undefined }
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Habits">
            {active.map((habit, i) => (
              <li key={habit.id}>
                <HabitCard
                  habit={habit}
                  logs={logsByHabit.get(habit.id) ?? EMPTY}
                  today={today}
                  onQuickLog={setQuickLog}
                  reorder={
                    reordering
                      ? { onUp: i > 0 ? () => move(i, -1) : undefined, onDown: i < active.length - 1 ? () => move(i, 1) : undefined }
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}

        {archived.length > 0 && !reordering && (
          <section className="mt-8">
            <button
              type="button"
              aria-expanded={showArchived}
              onClick={() => setShowArchived((v) => !v)}
              className="flex h-9 items-center gap-1.5 rounded-md px-1 text-small text-text-muted hover:text-text touch:h-11"
            >
              <Archive className="size-4" aria-hidden />
              Archived <span className="tabular">({archived.length})</span>
              <ChevronDown aria-hidden className={cn('size-4 transition-transform', showArchived && 'rotate-180')} />
            </button>
            {showArchived && (
              <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {archived.map((habit) => (
                  <li key={habit.id}>
                    <HabitCard habit={habit} logs={logsByHabit.get(habit.id) ?? EMPTY} today={today} onQuickLog={setQuickLog} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <footer className="mt-12 text-center text-micro text-text-faint">
          Prototype · Your data is saved in this browser only and doesn't sync between devices.
        </footer>
      </Page>

      <HabitFormDialog open={creating} onOpenChange={setCreating} />
      {quickLog && <DaySheet habit={quickLog} date={today} onClose={() => setQuickLog(null)} />}
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset all data?"
        description="This permanently deletes every habit and all logged progress stored in this browser."
        confirmLabel="Delete everything"
        onConfirm={async () => {
          await actions.resetAll()
          toast('All data cleared')
        }}
      />
    </>
  )
}
