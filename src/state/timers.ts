import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { elapsedMs, pauseTimer, resumeTimer, startTimer, timerPhase, type TimerState } from '@/domain/timer'

/**
 * Habit timers live in this device's localStorage (not in habit data): a timer is a
 * moment-to-moment thing on one device, and only the minutes you choose to add are synced.
 */
const KEY = 'commit.timers.v1'
type Timers = Record<string, TimerState>

const listeners = new Set<() => void>()
let cache: Timers | null = null

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function read(): Timers {
  if (cache) return cache
  let parsed: Timers = {}
  try {
    const raw = storage()?.getItem(KEY)
    const value: unknown = raw ? JSON.parse(raw) : {}
    if (value && typeof value === 'object') {
      for (const [id, t] of Object.entries(value as Record<string, Partial<TimerState>>)) {
        if (t && typeof t.bankedMs === 'number' && (t.startedAt === null || typeof t.startedAt === 'number')) {
          parsed[id] = { startedAt: t.startedAt, bankedMs: t.bankedMs }
        }
      }
    }
  } catch {
    parsed = {}
  }
  cache = parsed
  return parsed
}

function write(next: Timers) {
  cache = next
  try {
    storage()?.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked: the timer still works until the page closes.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function setTimer(habitId: string, state: TimerState | undefined) {
  const next = { ...read() }
  if (state) next[habitId] = state
  else delete next[habitId]
  write(next)
}

export function getTimer(habitId: string): TimerState | undefined {
  return read()[habitId]
}

/** Test helper. */
export function resetTimerCache() {
  cache = null
}

/** Re-renders once a second while `active`, returning the current time. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setNow(Date.now())
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

export function useHabitTimer(habitId: string) {
  const state = useSyncExternalStore(subscribe, () => read()[habitId])
  const phase = timerPhase(state)
  const now = useNow(phase === 'running')
  const start = useCallback(() => setTimer(habitId, startTimer(Date.now())), [habitId])
  const pause = useCallback(() => {
    const t = getTimer(habitId)
    if (t) setTimer(habitId, pauseTimer(t, Date.now()))
  }, [habitId])
  const resume = useCallback(() => {
    const t = getTimer(habitId)
    if (t) setTimer(habitId, resumeTimer(t, Date.now()))
  }, [habitId])
  const clear = useCallback(() => setTimer(habitId, undefined), [habitId])
  return { state, phase, elapsed: elapsedMs(state, phase === 'running' ? Math.max(now, Date.now()) : now), start, pause, resume, clear }
}
