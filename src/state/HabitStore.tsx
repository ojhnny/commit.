import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { indexLogs } from '@/domain/progress'
import { sortNotes } from '@/domain/notes'
import type { DateKey, Habit, HabitLog, HabitNote } from '@/domain/types'
import type { BackupFile, HabitPatch, HabitRepository, LogInput, NewHabitInput, NoteInput } from '@/services/habitRepository'
import { useToday } from '@/hooks/useToday'

type Status = 'loading' | 'ready' | 'error'

interface StoreValue {
  status: Status
  error: string | null
  today: DateKey
  /** All habits sorted by dashboard order (active and archived). */
  habits: Habit[]
  /** habitId → (date → log). Each habit's history is kept separately. */
  logsByHabit: ReadonlyMap<string, ReadonlyMap<DateKey, HabitLog>>
  /** habitId → notes, newest edit first. */
  notesByHabit: ReadonlyMap<string, readonly HabitNote[]>
  actions: {
    createHabit(input: NewHabitInput): Promise<Habit | null>
    updateHabit(id: string, patch: HabitPatch): Promise<Habit | null>
    archiveHabit(id: string): Promise<void>
    restoreHabit(id: string): Promise<void>
    deleteHabit(id: string): Promise<boolean>
    reorderHabits(ids: string[]): Promise<void>
    saveLog(habitId: string, date: DateKey, input: LogInput): Promise<boolean>
    clearLog(habitId: string, date: DateKey): Promise<void>
    /** Saves and shows a toast with an Undo action that restores the previous entry. */
    logWithUndo(habitId: string, date: DateKey, input: LogInput, message: string): Promise<boolean>
    clearWithUndo(habitId: string, date: DateKey, message: string): Promise<void>
    /** Note changes update local state from the result instead of reloading everything (autosave runs often). */
    createNote(habitId: string, input: NoteInput): Promise<HabitNote | null>
    /** Throws on failure so the editor can show "Couldn't save". */
    updateNote(noteId: string, patch: Partial<NoteInput>): Promise<HabitNote>
    deleteNote(noteId: string): Promise<boolean>
    /** Deletes and shows a toast with Undo, which recreates the note. */
    deleteNoteWithUndo(note: HabitNote, message: string): Promise<boolean>
    /** Follows note id changes (in Obsidian a note's id is its file path, which changes with the title). */
    resolveNoteId(id: string): string
    exportData(): Promise<BackupFile | null>
    importData(backup: unknown): Promise<boolean>
    removeSampleData(): Promise<void>
    loadSampleData(): Promise<void>
    resetAll(): Promise<void>
    reload(): Promise<void>
  }
}

const StoreContext = createContext<StoreValue | null>(null)
const EMPTY_LOGS: ReadonlyMap<DateKey, HabitLog> = new Map()
const EMPTY_NOTES: readonly HabitNote[] = []

function groupNotes(notes: readonly HabitNote[]): Map<string, HabitNote[]> {
  const byHabit = new Map<string, HabitNote[]>()
  for (const note of sortNotes(notes)) {
    const list = byHabit.get(note.habitId)
    if (list) list.push(note)
    else byHabit.set(note.habitId, [note])
  }
  return byHabit
}

function groupLogs(logs: HabitLog[]): Map<string, Map<DateKey, HabitLog>> {
  const byHabit = new Map<string, HabitLog[]>()
  for (const log of logs) {
    const list = byHabit.get(log.habitId)
    if (list) list.push(log)
    else byHabit.set(log.habitId, [log])
  }
  return new Map([...byHabit].map(([id, list]) => [id, indexLogs(list)]))
}

export function HabitStoreProvider({
  repository,
  subscribe,
  children,
}: {
  repository: HabitRepository
  /** Called with a callback to run when the data changed outside the app (sync, another device, a manual edit). */
  subscribe?: (onExternalChange: () => void) => () => void
  children: ReactNode
}) {
  const today = useToday()
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [habits, setHabits] = useState<Habit[]>([])
  const [logsByHabit, setLogsByHabit] = useState<Map<string, Map<DateKey, HabitLog>>>(new Map())
  const [notes, setNotes] = useState<HabitNote[]>([])

  const noteAliases = useRef(new Map<string, string>())
  const logsRef = useRef(logsByHabit)
  logsRef.current = logsByHabit

  const reload = useCallback(async () => {
    try {
      const snap = await repository.load()
      setHabits([...snap.habits].sort((a, b) => a.order - b.order))
      setLogsByHabit(groupLogs(snap.logs))
      setNotes(snap.notes ?? [])
      setStatus('ready')
      setError(null)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }, [repository])

  useEffect(() => {
    void reload()
  }, [reload])

  // Pick up changes made on another device when this tab comes back into view.
  useEffect(() => {
    let last = Date.now()
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 30_000) return
      last = Date.now()
      void reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  // Reload when the data file changes outside the app (vault sync, another device).
  useEffect(() => subscribe?.(() => void reload()), [subscribe, reload])

  const run = useCallback(
    async <T,>(op: () => Promise<T>): Promise<T | null> => {
      try {
        const result = await op()
        await reload()
        return result
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Something went wrong.')
        return null
      }
    },
    [reload],
  )

  const actions = useMemo<StoreValue['actions']>(() => {
    const restore = (habitId: string, date: DateKey, prev: HabitLog | undefined) =>
      run<unknown>(() =>
        prev
          ? repository.upsertLog(habitId, date, { value: prev.value, note: prev.note })
          : repository.deleteLog(habitId, date),
      )
    return {
      createHabit: (input) => run(() => repository.createHabit(input)),
      updateHabit: (id, patch) => run(() => repository.updateHabit(id, patch)),
      archiveHabit: async (id) => void (await run(() => repository.archiveHabit(id))),
      restoreHabit: async (id) => void (await run(() => repository.restoreHabit(id))),
      deleteHabit: async (id) => (await run(() => repository.deleteHabit(id).then(() => true))) ?? false,
      reorderHabits: async (ids) => void (await run(() => repository.reorderHabits(ids))),
      saveLog: async (habitId, date, input) =>
        (await run(() => repository.upsertLog(habitId, date, input).then(() => true))) ?? false,
      clearLog: async (habitId, date) => void (await run(() => repository.deleteLog(habitId, date))),
      logWithUndo: async (habitId, date, input, message) => {
        const prev = logsRef.current.get(habitId)?.get(date)
        const ok = (await run(() => repository.upsertLog(habitId, date, input).then(() => true))) ?? false
        if (ok) toast.success(message, { action: { label: 'Undo', onClick: () => void restore(habitId, date, prev) } })
        return ok
      },
      clearWithUndo: async (habitId, date, message) => {
        const prev = logsRef.current.get(habitId)?.get(date)
        await run(() => repository.deleteLog(habitId, date))
        toast(message, { action: { label: 'Undo', onClick: () => void restore(habitId, date, prev) } })
      },
      createNote: async (habitId, input) => {
        try {
          const note = await repository.createNote(habitId, input)
          setNotes((list) => [...list.filter((n) => n.id !== note.id), note])
          return note
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Something went wrong.')
          return null
        }
      },
      updateNote: async (noteId, patch) => {
        const note = await repository.updateNote(noteId, patch)
        if (note.id !== noteId) noteAliases.current.set(noteId, note.id)
        // The id can change (in Obsidian it is the file path, which follows the title).
        setNotes((list) => [...list.filter((n) => n.id !== noteId && n.id !== note.id), note])
        return note
      },
      deleteNote: async (noteId) => {
        try {
          await repository.deleteNote(noteId)
          setNotes((list) => list.filter((n) => n.id !== noteId))
          return true
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Something went wrong.')
          return false
        }
      },
      deleteNoteWithUndo: async (note, message) => {
        try {
          await repository.deleteNote(note.id)
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Something went wrong.')
          return false
        }
        setNotes((list) => list.filter((n) => n.id !== note.id))
        toast(message, {
          action: {
            label: 'Undo',
            onClick: () =>
              void repository
                .createNote(note.habitId, { title: note.title, body: note.body })
                .then((restored) => setNotes((list) => [...list, restored]))
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Something went wrong.')),
          },
        })
        return true
      },
      resolveNoteId: (id) => {
        let current = id
        for (let i = 0; i < 20 && noteAliases.current.has(current); i++) current = noteAliases.current.get(current)!
        return current
      },
      exportData: () => run(() => repository.exportData()),
      importData: async (backup) => (await run(() => repository.importData(backup).then(() => true))) ?? false,
      removeSampleData: async () => void (await run(() => repository.removeSampleData())),
      loadSampleData: async () => void (await run(() => repository.loadSampleData())),
      resetAll: async () => void (await run(() => repository.resetAll())),
      reload,
    }
  }, [repository, run, reload])

  const notesByHabit = useMemo(() => groupNotes(notes), [notes])

  const value = useMemo<StoreValue>(
    () => ({ status, error, today, habits, logsByHabit, notesByHabit, actions }),
    [status, error, today, habits, logsByHabit, notesByHabit, actions],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside HabitStoreProvider')
  return ctx
}

export function useHabitLogs(habitId: string | undefined): ReadonlyMap<DateKey, HabitLog> {
  const { logsByHabit } = useStore()
  return (habitId && logsByHabit.get(habitId)) || EMPTY_LOGS
}

export function useHabitNotes(habitId: string | undefined): readonly HabitNote[] {
  const { notesByHabit } = useStore()
  return (habitId && notesByHabit.get(habitId)) || EMPTY_NOTES
}
