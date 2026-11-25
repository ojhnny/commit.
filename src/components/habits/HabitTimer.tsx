import { Minus, Pause, Play, Plus, Square } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { currentGoal } from '@/domain/scheduling'
import { formatClock, formatMinutes, minutesInUnit, suggestedMinutes } from '@/domain/timer'
import type { Habit, HabitLog } from '@/domain/types'
import { formatProgress } from '@/domain/units'
import { Button } from '@/components/ui/button'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import { useStore } from '@/state/HabitStore'
import { setTimer, useHabitTimer } from '@/state/timers'

const MAX_MINUTES = 24 * 60

/** Start / pause / stop timer for a time-based habit (DESIGN.md §8 Habit timer). */
export function HabitTimer({ habit, todayLog }: { habit: Habit; todayLog: HabitLog | undefined }) {
  const { today, actions } = useStore()
  const timer = useHabitTimer(habit.id)
  const [stopping, setStopping] = useState<{ wasRunning: boolean } | null>(null)
  const [minutes, setMinutes] = useState(1)
  const clock = formatClock(timer.elapsed)

  if (timer.phase === 'idle') {
    return (
      <Button variant="outline" onClick={timer.start} className="gap-2 rounded-full pr-4 pl-3 max-sm:h-11 max-sm:w-full">
        <span aria-hidden className="size-2 rounded-full bg-timer" />
        Start timer
      </Button>
    )
  }

  const paused = timer.phase === 'paused'
  const goal = currentGoal(habit, today)
  const current = todayLog?.value ?? 0
  const newTotal = Math.round((current + minutesInUnit(goal, minutes)) * 100) / 100

  const openStop = () => {
    const wasRunning = timer.phase === 'running'
    timer.pause()
    setMinutes(suggestedMinutes(timer.elapsed))
    setStopping({ wasRunning })
  }

  const keepTiming = () => {
    if (stopping?.wasRunning) timer.resume()
    setStopping(null)
  }

  const discard = () => {
    const saved = timer.state
    timer.clear()
    setStopping(null)
    toast('Timer discarded', { action: saved ? { label: 'Undo', onClick: () => setTimer(habit.id, saved) } : undefined })
  }

  const add = async () => {
    const ok = await actions.logWithUndo(
      habit.id,
      today,
      { value: newTotal, note: todayLog?.note },
      `Added ${formatMinutes(minutes)} to ${habit.name}`,
    )
    if (ok) {
      timer.clear()
      setStopping(null)
    }
  }

  return (
    <>
      <div
        role="timer"
        aria-label={`${habit.name} timer, ${paused ? 'paused' : 'running'}`}
        className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-border bg-surface py-1 pr-1 pl-3.5 max-sm:flex max-sm:h-11 max-sm:w-full"
      >
        <span aria-hidden className={paused ? 'mr-1 size-2 rounded-full bg-text-faint' : 'mr-1 size-2 animate-[pulse_2s_ease-in-out_infinite] rounded-full bg-timer motion-reduce:animate-none'} />
        <span className={`tabular text-[15px] font-medium max-sm:mr-auto ${paused ? 'text-text-muted' : 'text-text'}`}>
          {clock}
          {paused && <span className="ml-2 text-small font-normal text-text-faint">Paused</span>}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label={paused ? 'Resume timer' : 'Pause timer'} className="ml-2 rounded-full" onClick={paused ? timer.resume : timer.pause}>
          {paused ? <Play className="fill-current" /> : <Pause className="fill-current" />}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Stop timer" className="rounded-full text-timer hover:text-timer" onClick={openStop}>
          <Square className="size-3.5! fill-current" />
        </Button>
      </div>

      <ResponsiveDialog open={stopping !== null} onOpenChange={(o) => !o && setStopping(null)} title="Timer stopped" description={habit.name}>
        <p className="tabular text-[36px] leading-none font-medium tracking-tight text-text">{clock}</p>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <span className="text-body text-text" id={`timer-add-${habit.id}`}>
            Add to today
          </span>
          <div className="flex items-center gap-1" role="group" aria-labelledby={`timer-add-${habit.id}`}>
            <Button variant="ghost" size="icon-sm" aria-label="One minute less" disabled={minutes <= 1} onClick={() => setMinutes((m) => Math.max(1, m - 1))}>
              <Minus />
            </Button>
            <span className="tabular w-20 text-center text-body font-medium text-text" aria-live="polite">
              {formatMinutes(minutes)}
            </span>
            <Button variant="ghost" size="icon-sm" aria-label="One minute more" disabled={minutes >= MAX_MINUTES} onClick={() => setMinutes((m) => Math.min(MAX_MINUTES, m + 1))}>
              <Plus />
            </Button>
          </div>
        </div>
        <p className="tabular mt-1 text-small text-text-muted">New total today: {formatProgress(goal, newTotal)}</p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button variant="danger-ghost" className="sm:mr-auto sm:px-2" onClick={discard}>
            Discard
          </Button>
          <Button variant="ghost" onClick={keepTiming}>
            Keep timing
          </Button>
          <Button className="border-0 bg-timer text-bg hover:bg-timer/90 max-sm:h-11" onClick={() => void add()}>
            Add {formatMinutes(minutes)}
          </Button>
        </div>
      </ResponsiveDialog>
    </>
  )
}

/** Small "● 12:03" chip on dashboard cards and rows while a habit's timer runs or is paused. */
export function TimerChip({ habitId, className }: { habitId: string; className?: string }) {
  const timer = useHabitTimer(habitId)
  if (timer.phase === 'idle') return null
  const paused = timer.phase === 'paused'
  return (
    <span className={`tabular inline-flex shrink-0 items-center gap-1.5 text-small text-text-muted ${className ?? ''}`} title={paused ? 'Timer paused' : 'Timer running'}>
      <span aria-hidden className={paused ? 'size-1.5 rounded-full bg-text-faint' : 'size-1.5 rounded-full bg-timer'} />
      <span className="sr-only">Timer {paused ? 'paused' : 'running'}:</span>
      {formatClock(timer.elapsed)}
    </span>
  )
}
