import { toDateKey } from '@/domain/dates'
import { applyGoalChange, normalizeSchedule } from '@/domain/scheduling'
import { NOTE_BODY_MAX, NOTE_TITLE_MAX } from '@/domain/notes'
import type { DateKey, GoalVersion, Habit, HabitLog, HabitNote } from '@/domain/types'
import { buildSampleData } from './demoData'
import {
  type BackupFile,
  RepositoryError,
  type HabitPatch,
  type HabitRepository,
  type LogInput,
  type NewHabitInput,
  type NoteInput,
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
  /** Missing in data saved before notes existed. */
  notes?: HabitNote[]
}

function validNoteInput(input: Partial<NoteInput>): void {
  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.length > NOTE_TITLE_MAX))
    throw new RepositoryError('invalid', `Keep the title under ${NOTE_TITLE_MAX} characters.`)
  if (input.body !== undefined && (typeof input.body !== 'string' || input.body.length > NOTE_BODY_MAX))
    throw new RepositoryError('invalid', 'This note is too long to save.')
}

function isNote(n: unknown): n is HabitNote {
  const x = n as Partial<HabitNote> | null
  return !!x && typeof x.id === 'string' && typeof x.habitId === 'string' && typeof x.title === 'string' && typeof x.body === 'string'
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
      const initial: StoredState = { version: 1, habits: [], logs: [], notes: [] }
      if (this.seedOnFirstRun) {
        const sample = buildSampleData(this.today(), this.now().toISOString())
        initial.habits = sample.habits
        initial.logs = sample.logs
        initial.notes = sample.notes
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
    const { habits, logs, notes = [] } = this.read()
    return { habits, logs, notes }
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
      ...(input.color ? { color: input.color } : {}),
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
      if (patch.color !== undefined) next.color = patch.color ?? undefined
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

  /** Obsidian plugin: remembers which vault folder holds a habit's note files (undefined clears it). */
  async setNotesFolder(id: string, folder: string | undefined): Promise<Habit> {
    return this.mutateHabit(id, (h) => ({ ...h, notesFolder: folder }))
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
    state.notes = (state.notes ?? []).filter((n) => n.habitId !== id)
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

  // ---------------------------------------------------------------- notes

  async createNote(habitId: string, input: NoteInput): Promise<HabitNote> {
    validNoteInput(input)
    const state = this.read()
    if (!state.habits.some((h) => h.id === habitId)) throw new RepositoryError('not-found', 'Habit not found.')
    const ts = this.stamp()
    const note: HabitNote = { id: this.newId(), habitId, title: input.title.trim(), body: input.body, createdAt: ts, updatedAt: ts }
    state.notes = [...(state.notes ?? []), note]
    this.write(state)
    return note
  }

  async updateNote(noteId: string, patch: Partial<NoteInput>): Promise<HabitNote> {
    validNoteInput(patch)
    const state = this.read()
    const notes = state.notes ?? []
    const idx = notes.findIndex((n) => n.id === noteId)
    const current = notes[idx]
    if (!current) throw new RepositoryError('not-found', 'Note not found.')
    const next: HabitNote = {
      ...current,
      ...(patch.title !== undefined && { title: patch.title.trim() }),
      ...(patch.body !== undefined && { body: patch.body }),
      updatedAt: this.stamp(),
    }
    notes[idx] = next
    state.notes = notes
    this.write(state)
    return next
  }

  async deleteNote(noteId: string): Promise<void> {
    const state = this.read()
    state.notes = (state.notes ?? []).filter((n) => n.id !== noteId)
    this.write(state)
  }

  // ---------------------------------------------------------------- prototype helpers

  async removeSampleData(): Promise<void> {
    const state = this.read()
    const sampleIds = new Set(state.habits.filter((h) => h.isSample).map((h) => h.id))
    state.habits = state.habits.filter((h) => !sampleIds.has(h.id))
    state.logs = state.logs.filter((l) => !sampleIds.has(l.habitId))
    state.notes = (state.notes ?? []).filter((n) => !sampleIds.has(n.habitId))
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
    state.notes = [...(state.notes ?? []).filter((n) => keptIds.has(n.habitId)), ...sample.notes]
    this.write(state)
  }

  async exportData(): Promise<BackupFile> {
    const { habits, logs, notes = [] } = this.read()
    return { app: 'commit', version: 1, exportedAt: this.stamp(), habits, logs, notes }
  }

  async importData(backup: unknown): Promise<void> {
    const b = backup as Partial<BackupFile> | null
    const ok =
      b !== null &&
      typeof b === 'object' &&
      b.app === 'commit' &&
      b.version === 1 &&
      Array.isArray(b.habits) &&
      Array.isArray(b.logs) &&
      b.habits.every((h) => typeof h?.id === 'string' && typeof h?.name === 'string' && Array.isArray(h?.goalVersions) && h.goalVersions.length > 0) &&
      b.logs.every((l) => typeof l?.habitId === 'string' && typeof l?.date === 'string' && typeof l?.value === 'number') &&
      (b.notes === undefined || (Array.isArray(b.notes) && b.notes.every(isNote)))
    if (!ok) throw new RepositoryError('invalid', "That file isn't a commit. backup.")
    const ids = new Set(b.habits!.map((h) => h.id))
    this.write({ version: 1, habits: b.habits!, logs: b.logs!, notes: (b.notes ?? []).filter((n) => ids.has(n.habitId)) })
  }

  async resetAll(): Promise<void> {
    this.write({ version: 1, habits: [], logs: [], notes: [] })
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

