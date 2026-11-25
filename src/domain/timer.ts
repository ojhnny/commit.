import type { GoalVersion } from './types'

/**
 * A habit timer is stored as when the current run started plus time banked by earlier
 * runs, never as a ticking count, so it survives reloads and closed tabs (DESIGN.md §8).
 */
export interface TimerState {
  /** Epoch ms when the current run started; null while paused. */
  startedAt: number | null
  /** Milliseconds from earlier runs (before the last pause). */
  bankedMs: number
}

export type TimerPhase = 'idle' | 'running' | 'paused'

export function timerPhase(t: TimerState | undefined): TimerPhase {
  if (!t) return 'idle'
  return t.startedAt === null ? 'paused' : 'running'
}

export function elapsedMs(t: TimerState | undefined, now: number): number {
  if (!t) return 0
  return t.bankedMs + (t.startedAt === null ? 0 : Math.max(0, now - t.startedAt))
}

export function startTimer(now: number): TimerState {
  return { startedAt: now, bankedMs: 0 }
}

export function pauseTimer(t: TimerState, now: number): TimerState {
  return t.startedAt === null ? t : { startedAt: null, bankedMs: elapsedMs(t, now) }
}

export function resumeTimer(t: TimerState, now: number): TimerState {
  return t.startedAt === null ? { startedAt: now, bankedMs: t.bankedMs } : t
}

/** `mm:ss`, or `h:mm:ss` from one hour. */
export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** Minutes offered in the Stop dialog: rounded to the nearest minute, at least 1. */
export function suggestedMinutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000))
}

/** Converts timed minutes into the goal's unit (hours keep two decimals). */
export function minutesInUnit(goal: Pick<GoalVersion, 'unit'>, minutes: number): number {
  return goal.unit === 'hours' ? Math.round((minutes / 60) * 100) / 100 : minutes
}

export function canTime(goal: Pick<GoalVersion, 'unit'>): boolean {
  return goal.unit === 'minutes' || goal.unit === 'hours'
}

/** "24 min" / "1 h 5 min" for buttons and toasts. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
