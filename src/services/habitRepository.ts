import type { DateKey, GoalVersion, Habit, HabitColor, HabitLog, HabitNote } from '@/domain/types'

/**
 * Persistence boundary. Components and state never talk to storage directly.
 *
 * Two implementations: `LocalStorageHabitRepository` (this browser only) and
 * `HttpHabitRepository` (the FastAPI backend, synced across devices).
 */
export interface NewHabitInput {
  name: string
  description?: string
  startDate: DateKey
  goal: Omit<GoalVersion, 'effectiveDate'>
  color?: HabitColor
}

export interface HabitPatch {
  name?: string
  description?: string
  startDate?: DateKey
  /** New goal applied from `goalEffectiveDate` (a new goal version). */
  goal?: Omit<GoalVersion, 'effectiveDate'>
  goalEffectiveDate?: DateKey
  /** null removes the color. */
  color?: HabitColor | null
}

export interface LogInput {
  value: number
  note?: string
}

export interface NoteInput {
  title: string
  body: string
}

export interface Snapshot {
  habits: Habit[]
  logs: HabitLog[]
  notes: HabitNote[]
}

export interface BackupFile {
  app: 'commit'
  version: 1
  exportedAt: string
  habits: Habit[]
  logs: HabitLog[]
  /** Added with habit notes. Older backups have no `notes` and still import. */
  notes?: HabitNote[]
}

export interface HabitRepository {
  /** Everything at once. Fine for a personal prototype; the API will paginate by range. */
  load(): Promise<Snapshot>

  createHabit(input: NewHabitInput): Promise<Habit>
  updateHabit(id: string, patch: HabitPatch): Promise<Habit>
  archiveHabit(id: string): Promise<Habit>
  restoreHabit(id: string): Promise<Habit>
  deleteHabit(id: string): Promise<void>
  /** Persists a new dashboard order for the given habit ids. */
  reorderHabits(orderedIds: string[]): Promise<void>

  /** Creates or replaces the single entry for (habitId, date). */
  upsertLog(habitId: string, date: DateKey, input: LogInput): Promise<HabitLog>
  deleteLog(habitId: string, date: DateKey): Promise<void>

  /** Creates a note for a habit. */
  createNote(habitId: string, input: NoteInput): Promise<HabitNote>
  /** Changes a note's title and/or body. */
  updateNote(noteId: string, patch: Partial<NoteInput>): Promise<HabitNote>
  deleteNote(noteId: string): Promise<void>

  /** Full copy of everything, for backups. */
  exportData(): Promise<BackupFile>
  /** Replaces all data with a backup. Throws RepositoryError('invalid') for a bad file. */
  importData(backup: unknown): Promise<void>

  /** Prototype helpers. */
  removeSampleData(): Promise<void>
  loadSampleData(): Promise<void>
  resetAll(): Promise<void>
}

export type RepositoryErrorCode = 'not-found' | 'invalid' | 'storage' | 'auth' | 'network'

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode
  constructor(code: RepositoryErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'RepositoryError'
  }
}
