import { normalizePath, TFile, TFolder, type App, type EventRef, type TAbstractFile } from 'obsidian'
import { NOTE_BODY_MAX, safeFileName } from '@/domain/notes'
import type { Habit, HabitNote } from '@/domain/types'
import { RepositoryError, type NoteInput } from '@/services/habitRepository'

const UNTITLED = /^Untitled(?: \d+)?$/

/**
 * Habit notes as real Markdown files in the vault (DESIGN.md §14):
 * `<root>/<habit name>/<note title>.md`. A note's id is its vault path, its title the
 * file name and its body the file's content. Nothing else is added to the file.
 */
export class VaultNotes {
  private readonly app: App
  root: string
  private listeners = new Set<() => void>()
  private refs: EventRef[] = []
  /** Paths this class just wrote, so its own vault events don't trigger a reload. */
  private recent = new Map<string, number>()
  private emitTimer: ReturnType<typeof setTimeout> | undefined

  /** Called when a habit's notes folder was renamed or moved inside Obsidian. */
  onFolderMoved: (oldPath: string, newPath: string) => void = () => undefined

  constructor(app: App, root: string) {
    this.app = app
    this.root = normalizePath(root)
  }

  init(): void {
    const vault = this.app.vault
    const relevant = (path: string) => path.endsWith('.md') && !this.isRecent(path)
    this.refs.push(
      vault.on('create', (f) => relevant(f.path) && this.emitSoon()),
      vault.on('modify', (f) => relevant(f.path) && this.emitSoon()),
      vault.on('delete', (f) => (f instanceof TFolder || relevant(f.path)) && this.emitSoon()),
      vault.on('rename', (f: TAbstractFile, oldPath: string) => {
        if (f instanceof TFolder) this.onFolderMoved(oldPath, f.path)
        if (f instanceof TFolder || relevant(f.path) || relevant(oldPath)) this.emitSoon()
      }),
    )
  }

  destroy(): void {
    for (const ref of this.refs) this.app.vault.offref(ref)
    this.refs = []
    this.listeners.clear()
    clearTimeout(this.emitTimer)
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // ------------------------------------------------------------ folders

  /** The folder a habit's notes live in (assigned on first use). */
  folderOf(habit: Habit): string {
    return habit.notesFolder ?? normalizePath(`${this.root}/${safeFileName(habit.name, 'Habit')}`)
  }

  /** A free folder path for a habit that has none yet (two habits with the same name get "Name 2"). */
  newFolderFor(habit: Habit, taken: Iterable<string>): string {
    const used = new Set(taken)
    const base = normalizePath(`${this.root}/${safeFileName(habit.name, 'Habit')}`)
    let path = base
    for (let i = 2; used.has(path); i++) path = `${base} ${i}`
    return path
  }

  /** Renames a habit's folder to follow the habit's new name. Returns the new path. */
  async renameFolder(oldPath: string, newName: string): Promise<string | null> {
    const folder = this.app.vault.getAbstractFileByPath(oldPath)
    if (!(folder instanceof TFolder)) return null
    const parent = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : ''
    const base = normalizePath(`${parent}/${safeFileName(newName, 'Habit')}`)
    if (base === oldPath) return oldPath
    let path = base
    for (let i = 2; this.app.vault.getAbstractFileByPath(path); i++) path = `${base} ${i}`
    this.markRecent(oldPath, path)
    await this.app.fileManager.renameFile(folder, path)
    return path
  }

  async trashFolder(path: string): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(path)
    if (folder) await this.trash(folder)
  }

  // ------------------------------------------------------------ notes

  /** Every note of the given habits, read from their folders (including subfolders). */
  async list(habits: readonly Habit[]): Promise<HabitNote[]> {
    const byFolder = new Map(habits.map((h) => [this.folderOf(h), h.id]))
    const files = this.app.vault.getMarkdownFiles()
    const notes: HabitNote[] = []
    for (const file of files) {
      const habitId = this.habitForPath(file.path, byFolder)
      if (!habitId) continue
      notes.push(this.toNote(file, habitId, await this.app.vault.cachedRead(file)))
    }
    return notes
  }

  async create(habitId: string, folder: string, input: NoteInput): Promise<HabitNote> {
    if (input.body.length > NOTE_BODY_MAX) throw new RepositoryError('invalid', 'This note is too long to save.')
    await this.ensureFolder(folder)
    const path = this.freePath(folder, input.title)
    this.markRecent(path)
    const file = await this.app.vault.create(path, input.body)
    return this.toNote(file, habitId, input.body)
  }

  async update(id: string, habitId: string, patch: Partial<NoteInput>): Promise<HabitNote> {
    const file = this.app.vault.getAbstractFileByPath(id)
    if (!(file instanceof TFile)) throw new RepositoryError('not-found', 'Note not found. It may have been moved or deleted in Obsidian.')
    let body: string | undefined = patch.body
    if (body !== undefined) {
      if (body.length > NOTE_BODY_MAX) throw new RepositoryError('invalid', 'This note is too long to save.')
      this.markRecent(file.path)
      await this.app.vault.modify(file, body)
    }
    if (patch.title !== undefined) {
      const wanted = safeFileName(patch.title)
      const currentTitle = UNTITLED.test(file.basename) ? '' : file.basename
      if (patch.title.trim() !== currentTitle && wanted !== file.basename) {
        const folder = file.parent?.path ?? ''
        const path = this.freePath(folder, patch.title, file.path)
        this.markRecent(file.path, path)
        // Through the file manager so links to the note are updated.
        await this.app.fileManager.renameFile(file, path)
      }
    }
    body ??= await this.app.vault.cachedRead(file)
    return this.toNote(file, habitId, body)
  }

  async remove(id: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(id)
    if (!file) return
    this.markRecent(id)
    await this.trash(file)
  }

  /** Opens a note in a new Obsidian tab. */
  async open(id: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(id)
    if (file instanceof TFile) await this.app.workspace.getLeaf('tab').openFile(file)
  }

  // ------------------------------------------------------------ internals

  /** The habit whose notes folder contains `path`. */
  habitOf(path: string, habits: readonly Habit[]): string | undefined {
    return this.habitForPath(path, new Map(habits.map((h) => [this.folderOf(h), h.id])))
  }

  private habitForPath(path: string, byFolder: Map<string, string>): string | undefined {
    let best: string | undefined
    let bestLen = -1
    for (const [folder, id] of byFolder) {
      if (path.startsWith(`${folder}/`) && folder.length > bestLen) {
        best = id
        bestLen = folder.length
      }
    }
    return best
  }

  private toNote(file: TFile, habitId: string, body: string): HabitNote {
    return {
      id: file.path,
      habitId,
      // "Untitled", "Untitled 2" are file names for notes without a title.
      title: UNTITLED.test(file.basename) ? '' : file.basename,
      body,
      createdAt: new Date(file.stat.ctime).toISOString(),
      updatedAt: new Date(file.stat.mtime).toISOString(),
    }
  }

  private freePath(folder: string, title: string, current?: string): string {
    const base = safeFileName(title)
    const at = (name: string) => normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`)
    let path = at(base)
    for (let i = 2; path !== current && this.app.vault.getAbstractFileByPath(path); i++) path = at(`${base} ${i}`)
    return path
  }

  private async ensureFolder(path: string): Promise<void> {
    const parts = normalizePath(path).split('/')
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join('/')
      if (!this.app.vault.getAbstractFileByPath(p)) {
        try {
          await this.app.vault.createFolder(p)
        } catch {
          // Created meanwhile (sync); fine.
        }
      }
    }
  }

  private async trash(file: TAbstractFile): Promise<void> {
    const fm = this.app.fileManager as { trashFile?: (f: TAbstractFile) => Promise<void> }
    // trashFile follows the user's "Deleted files" setting (Obsidian 1.6.6+).
    if (fm.trashFile) await fm.trashFile(file)
    else await this.app.vault.trash(file, true)
  }

  private markRecent(...paths: string[]): void {
    const now = Date.now()
    for (const p of paths) this.recent.set(p, now)
  }

  private isRecent(path: string): boolean {
    const t = this.recent.get(path)
    if (t === undefined) return false
    if (Date.now() - t > 1500) {
      this.recent.delete(path)
      return false
    }
    return true
  }

  private emitSoon(): void {
    clearTimeout(this.emitTimer)
    this.emitTimer = setTimeout(() => {
      for (const l of this.listeners) l()
    }, 150)
  }
}
