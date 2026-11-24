import type { DateKey, GoalVersion, Habit, HabitLog } from '@/domain/types'

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
}

export interface HabitPatch {
  name?: string
  description?: string
  startDate?: DateKey
  /** New goal applied from `goalEffectiveDate` (a new goal version). */
  goal?: Omit<GoalVersion, 'effectiveDate'>
  goalEffectiveDate?: DateKey
}

export interface LogInput {
  value: number
  note?: string
}

export interface Snapshot {
  habits: Habit[]
  logs: HabitLog[]
}

export interface BackupFile extends Snapshot {
  app: 'commit'
  version: 1
  exportedAt: string
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
