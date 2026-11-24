import { toDateKey } from '@/domain/dates'
import { applyGoalChange, normalizeSchedule } from '@/domain/scheduling'
import type { DateKey, GoalVersion, Habit, HabitLog } from '@/domain/types'
import { buildSampleData } from './demoData'
import {
  RepositoryError,
  type HabitPatch,
  type HabitRepository,
  type LogInput,
  type NewHabitInput,
  type Snapshot,
} from './habitRepository'

/** Minimal storage contract (satisfied by window.localStorage, an in-memory map, or an AsyncStorage adapter). */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const STORAGE_KEY = 'commit:v1'

interface StoredState {
  version: 1
  habits: Habit[]
  logs: HabitLog[]
}

export interface RepositoryOptions {
  storage: KeyValueStorage
  now?: () => Date
  newId?: () => string
  /** Seed sample habits the first time (when nothing is stored yet). */
  seedOnFirstRun?: boolean
}

function defaultId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * When the start date moves, the first goal version must start on it:
 * versions that began on/before the new start collapse into one starting there.
 */
export function rebaseGoalVersions(versions: GoalVersion[], startDate: DateKey): GoalVersion[] {
  const before = versions.filter((v) => v.effectiveDate <= startDate)
  const after = versions.filter((v) => v.effectiveDate > startDate)
  const base = before[before.length - 1] ?? after.shift()
  if (!base) return versions
  return [{ ...base, effectiveDate: startDate }, ...after]
}

export class LocalStorageHabitRepository implements HabitRepository {
  private readonly storage: KeyValueStorage
  private readonly now: () => Date
  private readonly newId: () => string
  private readonly seedOnFirstRun: boolean

  constructor(options: RepositoryOptions) {
    this.storage = options.storage
    this.now = options.now ?? (() => new Date())
    this.newId = options.newId ?? defaultId
    this.seedOnFirstRun = options.seedOnFirstRun ?? false
  }

  // ---------------------------------------------------------------- storage

  private read(): StoredState {
    let raw: string | null
    try {
      raw = this.storage.getItem(STORAGE_KEY)
    } catch {
      throw new RepositoryError('storage', 'Browser storage is unavailable.')
    }
    if (raw === null) {
      const initial: StoredState = { version: 1, habits: [], logs: [] }
      if (this.seedOnFirstRun) {
        const sample = buildSampleData(this.today(), this.now().toISOString())
        initial.habits = sample.habits
        initial.logs = sample.logs
      }
      this.write(initial)
      return initial
    }
    try {
      const parsed = JSON.parse(raw) as StoredState
      if (parsed.version !== 1 || !Array.isArray(parsed.habits) || !Array.isArray(parsed.logs)) throw new Error()
      return parsed
    } catch {
      throw new RepositoryError('storage', 'Saved data could not be read.')
    }
  }

  private write(state: StoredState): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      throw new RepositoryError('storage', 'Could not save. Browser storage may be full or blocked.')
    }
  }

  private today(): DateKey {
    return toDateKey(this.now())
  }

  private stamp(): string {
    return this.now().toISOString()
  }

  private mutateHabit(id: string, fn: (h: Habit) => Habit): Habit {
    const state = this.read()
    const idx = state.habits.findIndex((h) => h.id === id)
    const current = state.habits[idx]
    if (!current) throw new RepositoryError('not-found', 'Habit not found.')
    const next = { ...fn(current), updatedAt: this.stamp() }
    state.habits[idx] = next
    this.write(state)
    return next
  }

  // ---------------------------------------------------------------- reads

  async load(): Promise<Snapshot> {
    const { habits, logs } = this.read()
    return { habits, logs }
  }

  // ---------------------------------------------------------------- habits

  async createHabit(input: NewHabitInput): Promise<Habit> {
    const state = this.read()
    const ts = this.stamp()
    const order = state.habits.reduce((max, h) => Math.max(max, h.order), -1) + 1
    const habit: Habit = {
      id: this.newId(),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      startDate: input.startDate,
      goalVersions: [
        { ...input.goal, schedule: normalizeSchedule(input.goal.schedule), effectiveDate: input.startDate },
      ],
      order,
      createdAt: ts,
      updatedAt: ts,
      archivedAt: null,
    }
    state.habits.push(habit)
    this.write(state)
    return habit
  }

  async updateHabit(id: string, patch: HabitPatch): Promise<Habit> {
    return this.mutateHabit(id, (h) => {
      let next: Habit = { ...h }
      if (patch.name !== undefined) next.name = patch.name.trim()
      if (patch.description !== undefined) next.description = patch.description.trim() || undefined
      if (patch.startDate !== undefined && patch.startDate !== h.startDate) {
        next.startDate = patch.startDate
        next.goalVersions = rebaseGoalVersions(next.goalVersions, patch.startDate)
      }
      if (patch.goal) {
        // Changes apply from today (or the start date, if it's in the future) so
        // past days keep being judged by the rules that applied then.
        const effective = patch.goalEffectiveDate ?? (this.today() > next.startDate ? this.today() : next.startDate)
        next = {
          ...next,
          goalVersions: applyGoalChange(
            next.goalVersions,
            { ...patch.goal, schedule: normalizeSchedule(patch.goal.schedule) },
            effective,
          ),
        }
      }
      return next
    })
  }

  async archiveHabit(id: string): Promise<Habit> {
    return this.mutateHabit(id, (h) => ({ ...h, archivedAt: this.stamp() }))
  }

  async restoreHabit(id: string): Promise<Habit> {
    return this.mutateHabit(id, (h) => ({ ...h, archivedAt: null }))
  }

  async deleteHabit(id: string): Promise<void> {
    const state = this.read()
    if (!state.habits.some((h) => h.id === id)) throw new RepositoryError('not-found', 'Habit not found.')
    state.habits = state.habits.filter((h) => h.id !== id)
    state.logs = state.logs.filter((l) => l.habitId !== id)
    this.write(state)
  }

  async reorderHabits(orderedIds: string[]): Promise<void> {
    const state = this.read()
    const position = new Map(orderedIds.map((id, i) => [id, i]))
    const offset = orderedIds.length
    state.habits = state.habits.map((h) => ({ ...h, order: position.get(h.id) ?? offset + h.order }))
    this.write(state)
  }

  // ---------------------------------------------------------------- logs

  async upsertLog(habitId: string, date: DateKey, input: LogInput): Promise<HabitLog> {
    const state = this.read()
    const habit = state.habits.find((h) => h.id === habitId)
    if (!habit) throw new RepositoryError('not-found', 'Habit not found.')
    if (date > this.today()) throw new RepositoryError('invalid', 'Cannot log progress for a future date.')
    if (date < habit.startDate) throw new RepositoryError('invalid', 'Cannot log before the habit started.')
    if (!Number.isFinite(input.value) || input.value < 0) throw new RepositoryError('invalid', 'Invalid value.')

    const ts = this.stamp()
    const note = input.note?.trim() || undefined
    const idx = state.logs.findIndex((l) => l.habitId === habitId && l.date === date)
    const existing = state.logs[idx]
    let log: HabitLog
    if (existing) {
      log = { ...existing, value: input.value, note, updatedAt: ts }
      state.logs[idx] = log
    } else {
      log = { id: this.newId(), habitId, date, value: input.value, note, createdAt: ts, updatedAt: ts }
      state.logs.push(log)
    }
    this.write(state)
    return log
  }

  async deleteLog(habitId: string, date: DateKey): Promise<void> {
    const state = this.read()
    state.logs = state.logs.filter((l) => !(l.habitId === habitId && l.date === date))
    this.write(state)
  }

  // ---------------------------------------------------------------- prototype helpers

  async removeSampleData(): Promise<void> {
    const state = this.read()
    const sampleIds = new Set(state.habits.filter((h) => h.isSample).map((h) => h.id))
    state.habits = state.habits.filter((h) => !sampleIds.has(h.id))
    state.logs = state.logs.filter((l) => !sampleIds.has(l.habitId))
    this.write(state)
  }

  async loadSampleData(): Promise<void> {
    const state = this.read()
    const withoutSample = state.habits.filter((h) => !h.isSample)
    const keptIds = new Set(withoutSample.map((h) => h.id))
    const sample = buildSampleData(this.today(), this.stamp())
    const offset = withoutSample.length
    state.habits = [...withoutSample, ...sample.habits.map((h) => ({ ...h, order: h.order + offset }))]
    state.logs = [...state.logs.filter((l) => keptIds.has(l.habitId)), ...sample.logs]
    this.write(state)
  }

  async resetAll(): Promise<void> {
    this.write({ version: 1, habits: [], logs: [] })
  }
}

/** In-memory storage for tests and non-browser environments. */
export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

