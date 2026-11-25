import { toDateKey } from '@/domain/dates'
import type { DateKey, GoalVersion, Habit, HabitLog, HabitNote } from '@/domain/types'
import type { ApiClient } from './apiClient'
import { buildSampleData } from './demoData'
import {
  type BackupFile,
  type HabitPatch,
  type HabitRepository,
  type LogInput,
  type NewHabitInput,
  type NoteInput,
  RepositoryError,
  type Snapshot,
} from './habitRepository'

// The API sends null for empty optional fields; the app's types use undefined.
type WireGoal = Omit<GoalVersion, 'customUnit'> & { customUnit?: string | null }
type WireHabit = Omit<Habit, 'description' | 'goalVersions' | 'color'> & { description?: string | null; color?: Habit['color'] | null; goalVersions: WireGoal[] }
type WireLog = Omit<HabitLog, 'note'> & { note?: string | null }

function goalFromWire(g: WireGoal): GoalVersion {
  return { ...g, customUnit: g.customUnit ?? undefined }
}

function habitFromWire(h: WireHabit): Habit {
  return { ...h, description: h.description ?? undefined, color: h.color ?? undefined, goalVersions: h.goalVersions.map(goalFromWire) }
}

function logFromWire(l: WireLog): HabitLog {
  return { ...l, note: l.note ?? undefined }
}

function isBackup(b: unknown): b is BackupFile {
  const x = b as Partial<BackupFile> | null
  return x !== null && typeof x === 'object' && x.app === 'commit' && x.version === 1 && Array.isArray(x.habits) && Array.isArray(x.logs)
}

const enc = encodeURIComponent

/** Talks to the commit. API. Same contract as the browser-only repository. */
export class HttpHabitRepository implements HabitRepository {
  private readonly api: ApiClient

  constructor(api: ApiClient) {
    this.api = api
  }

  async load(): Promise<Snapshot> {
    const s = await this.api.request<{ habits: WireHabit[]; logs: WireLog[]; notes?: HabitNote[] }>('GET', '/snapshot')
    return { habits: s.habits.map(habitFromWire), logs: s.logs.map(logFromWire), notes: s.notes ?? [] }
  }

  async createHabit(input: NewHabitInput): Promise<Habit> {
    return habitFromWire(await this.api.request<WireHabit>('POST', '/habits', input))
  }

  async updateHabit(id: string, patch: HabitPatch): Promise<Habit> {
    return habitFromWire(await this.api.request<WireHabit>('PATCH', `/habits/${enc(id)}`, patch))
  }

  async archiveHabit(id: string): Promise<Habit> {
    return habitFromWire(await this.api.request<WireHabit>('POST', `/habits/${enc(id)}/archive`))
  }

  async restoreHabit(id: string): Promise<Habit> {
    return habitFromWire(await this.api.request<WireHabit>('POST', `/habits/${enc(id)}/restore`))
  }

  async deleteHabit(id: string): Promise<void> {
    await this.api.request('DELETE', `/habits/${enc(id)}`)
  }

  async reorderHabits(orderedIds: string[]): Promise<void> {
    await this.api.request('PUT', '/habits/order', { orderedIds })
  }

  async upsertLog(habitId: string, date: DateKey, input: LogInput): Promise<HabitLog> {
    return logFromWire(await this.api.request<WireLog>('PUT', `/habits/${enc(habitId)}/logs/${date}`, input))
  }

  async deleteLog(habitId: string, date: DateKey): Promise<void> {
    await this.api.request('DELETE', `/habits/${enc(habitId)}/logs/${date}`)
  }

  async createNote(habitId: string, input: NoteInput): Promise<HabitNote> {
    return this.api.request<HabitNote>('POST', `/habits/${enc(habitId)}/notes`, input)
  }

  async updateNote(noteId: string, patch: Partial<NoteInput>): Promise<HabitNote> {
    return this.api.request<HabitNote>('PATCH', `/notes/${enc(noteId)}`, patch)
  }

  async deleteNote(noteId: string): Promise<void> {
    await this.api.request('DELETE', `/notes/${enc(noteId)}`)
  }

  async exportData(): Promise<BackupFile> {
    const b = await this.api.request<Omit<BackupFile, 'habits' | 'logs'> & { habits: WireHabit[]; logs: WireLog[] }>('GET', '/export')
    return { ...b, habits: b.habits.map(habitFromWire), logs: b.logs.map(logFromWire), notes: b.notes ?? [] }
  }

  async importData(backup: unknown): Promise<void> {
    await this.import(backup, 'replace')
  }

  /** Adds the habits in a backup to the account (used to move browser-only data over). */
  async mergeData(backup: unknown): Promise<{ habits: number; logs: number; notes?: number }> {
    return this.import(backup, 'merge')
  }

  private async import(backup: unknown, mode: 'merge' | 'replace'): Promise<{ habits: number; logs: number; notes?: number }> {
    if (!isBackup(backup)) throw new RepositoryError('invalid', "That file isn't a commit. backup.")
    try {
      return await this.api.request('POST', `/import?mode=${mode}`, backup)
    } catch (e) {
      if (e instanceof RepositoryError && e.code === 'invalid') throw new RepositoryError('invalid', "That file isn't a commit. backup.")
      throw e
    }
  }

  async removeSampleData(): Promise<void> {
    await this.api.request('DELETE', '/sample-data')
  }

  async loadSampleData(): Promise<void> {
    const now = new Date()
    const sample = buildSampleData(toDateKey(now), now.toISOString())
    await this.removeSampleData()
    await this.mergeData({ app: 'commit', version: 1, exportedAt: now.toISOString(), ...sample })
  }

  async resetAll(): Promise<void> {
    await this.api.request('DELETE', '/data')
  }
}
