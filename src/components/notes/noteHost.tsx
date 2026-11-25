import { createContext, useContext, type ReactNode } from 'react'
import type { HabitNote } from '@/domain/types'

/** Optional extras a host app adds to notes (the Obsidian plugin opens notes in its own editor). */
export interface NoteHost {
  /** Menu label, e.g. "Open in Obsidian". */
  openLabel: string
  open(note: HabitNote): void
}

const NoteHostContext = createContext<NoteHost | null>(null)

export function NoteHostProvider({ host, children }: { host: NoteHost | null; children: ReactNode }) {
  return <NoteHostContext.Provider value={host}>{children}</NoteHostContext.Provider>
}

export function useNoteHost(): NoteHost | null {
  return useContext(NoteHostContext)
}
