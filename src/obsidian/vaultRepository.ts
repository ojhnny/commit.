import type { DateKey, Habit, HabitLog, HabitNote } from '@/domain/types'
import type { BackupFile, HabitPatch, HabitRepository, LogInput, NewHabitInput, NoteInput, Snapshot } from '@/services/habitRepository'
import { RepositoryError } from '@/services/habitRepository'
import type { LocalStorageHabitRepository } from '@/services/localStorageRepository'
import type { VaultNotes } from './vaultNotes'

/**
 * The plugin's repository: habits and logs in the JSON data file (through the shared
 * LocalStorageHabitRepository), notes as Markdown files in the vault (VaultNotes).
 */
export class VaultHabitRepository implements HabitRepository {
  private readonly data: LocalStorageHabitRepository
  private readonly notes: VaultNotes
  /** Steps that assign folders or move notes run one at a time (views reload in parallel). */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(data: LocalStorageHabitRepository, notes: VaultNotes) {
    this.data = data
    this.notes = notes
    notes.onFolderMoved = (oldPath, newPath) => void this.followFolder(oldPath, newPath)
  }

  async load(): Promise<Snapshot> {
    await this.serial(() => this.moveJsonNotesToFiles())
    const { habits, logs } = await this.data.load()
    return { habits, logs, notes: await this.notes.list(habits) }
  }

  // ---------------------------------------------------------------- habits

  createHabit(input: NewHabitInput): Promise<Habit> {
    return this.data.createHabit(input)
  }

  async updateHabit(id: string, patch: HabitPatch): Promise<Habit> {
    const before = await this.habit(id)
    let habit = await this.data.updateHabit(id, patch)
    // The notes folder follows the habit's name, if it was named after it.
    if (patch.name !== undefined && before.notesFolder && habit.name !== before.name) {
      const moved = await this.notes.renameFolder(before.notesFolder, habit.name)
      if (moved && moved !== before.notesFolder) habit = await this.data.setNotesFolder(id, moved)
    }
    return habit
  }

  archiveHabit(id: string): Promise<Habit> {
    return this.data.archiveHabit(id)
  }

  restoreHabit(id: string): Promise<Habit> {
    return this.data.restoreHabit(id)
  }

  async deleteHabit(id: string): Promise<void> {
    const habit = await this.habit(id)
    if (habit.notesFolder) await this.notes.trashFolder(habit.notesFolder)
    await this.data.deleteHabit(id)
  }

  reorderHabits(orderedIds: string[]): Promise<void> {
    return this.data.reorderHabits(orderedIds)
  }

  upsertLog(habitId: string, date: DateKey, input: LogInput): Promise<HabitLog> {
    return this.data.upsertLog(habitId, date, input)
  }

  deleteLog(habitId: string, date: DateKey): Promise<void> {
    return this.data.deleteLog(habitId, date)
  }

  // ---------------------------------------------------------------- notes

  async createNote(habitId: string, input: NoteInput): Promise<HabitNote> {
    return this.serial(async () => {
      const habit = await this.habit(habitId)
      return this.notes.create(habitId, await this.folderFor(habit), input)
    })
  }

  async updateNote(noteId: string, patch: Partial<NoteInput>): Promise<HabitNote> {
    const { habits } = await this.data.load()
    const habitId = this.notes.habitOf(noteId, habits)
    if (!habitId) throw new RepositoryError('not-found', 'Note not found. It may have been moved or deleted in Obsidian.')
    return this.notes.update(noteId, habitId, patch)
  }

  deleteNote(noteId: string): Promise<void> {
    return this.notes.remove(noteId)
  }

  // ---------------------------------------------------------------- data

  /** Backups hold habits and logs; notes are already files in the vault. */
  async exportData(): Promise<BackupFile> {
    const { notes: _notes, ...rest } = await this.data.exportData()
    return rest
  }

  /** Restoring a web backup that has notes writes them as files. */
  async importData(backup: unknown): Promise<void> {
    await this.serial(async () => {
      await this.data.importData(backup)
      await this.moveJsonNotesToFiles()
    })
  }

  async removeSampleData(): Promise<void> {
    const { habits } = await this.data.load()
    for (const h of habits) if (h.isSample && h.notesFolder) await this.notes.trashFolder(h.notesFolder)
    await this.data.removeSampleData()
  }

  async loadSampleData(): Promise<void> {
    const { habits } = await this.data.load()
    for (const h of habits) if (h.isSample && h.notesFolder) await this.notes.trashFolder(h.notesFolder)
    await this.serial(async () => {
      await this.data.loadSampleData()
      await this.moveJsonNotesToFiles()
    })
  }

  async resetAll(): Promise<void> {
    const { habits } = await this.data.load()
    for (const h of habits) if (h.notesFolder) await this.notes.trashFolder(h.notesFolder)
    await this.data.resetAll()
  }

  openNote(noteId: string): Promise<void> {
    return this.notes.open(noteId)
  }

  // ---------------------------------------------------------------- internals

  private serial<T>(step: () => Promise<T>): Promise<T> {
    const run = this.queue.then(step, step)
    this.queue = run.catch(() => undefined)
    return run
  }

  private async habit(id: string): Promise<Habit> {
    const habit = (await this.data.load()).habits.find((h) => h.id === id)
    if (!habit) throw new RepositoryError('not-found', 'Habit not found.')
    return habit
  }

  private async folderFor(habit: Habit): Promise<string> {
    if (habit.notesFolder) return habit.notesFolder
    const { habits } = await this.data.load()
    const taken = habits.flatMap((h) => (h.notesFolder ? [h.notesFolder] : []))
    const folder = this.notes.newFolderFor(habit, taken)
    await this.data.setNotesFolder(habit.id, folder)
    return folder
  }

  /** Notes that arrived in the JSON data (sample data, a web backup) become files. */
  private async moveJsonNotesToFiles(): Promise<void> {
    const { habits, notes } = await this.data.load()
    if (!notes.length) return
    for (const note of notes) {
      // Out of the JSON first, so a failure can't write the same note twice.
      await this.data.deleteNote(note.id)
      if (habits.some((h) => h.id === note.habitId)) {
        // Re-read: folderFor may have just assigned a folder to this habit.
        const habit = await this.habit(note.habitId)
        await this.notes.create(habit.id, await this.folderFor(habit), note)
      }
    }
  }

  /** The user renamed or moved a notes folder (or a parent) in Obsidian. */
  private async followFolder(oldPath: string, newPath: string): Promise<void> {
    const { habits } = await this.data.load()
    for (const h of habits) {
      if (!h.notesFolder) continue
      if (h.notesFolder === oldPath) await this.data.setNotesFolder(h.id, newPath)
      else if (h.notesFolder.startsWith(`${oldPath}/`)) await this.data.setNotesFolder(h.id, newPath + h.notesFolder.slice(oldPath.length))
    }
  }
}
