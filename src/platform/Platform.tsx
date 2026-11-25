import { createContext, useContext, type ReactNode } from 'react'
import type { HabitNote } from '@/domain/types'

/**
 * Host integration for the Obsidian plugin. Components ask the platform where to
 * portal overlays, how to save files and where the data lives, instead of
 * touching `document.body` or the browser download flow directly.
 */
export interface Platform {
  /** Element that dialogs, menus, sheets, tooltips and toasts render into. */
  portalContainer: HTMLElement | null
  /** Element that receives the `N` shortcut (only while focus is inside the view). */
  keyTarget: HTMLElement | null
  /** Human-readable location of the data, e.g. "commit/habits.json". */
  storageLabel: string
  /** Writes a backup file into the vault. Resolves to the path it was written to. */
  saveBackup(contents: string, fileName: string): Promise<string>
  /** Opens a note's file in the host's own editor (Obsidian). */
  openNote?(note: HabitNote): void
  /** Scrolls the view back to the top after navigation. */
  scrollToTop(): void
}

const PlatformContext = createContext<Platform | null>(null)

export function PlatformProvider({ platform, children }: { platform: Platform; children: ReactNode }) {
  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>
}

export function usePlatform(): Platform {
  const p = useContext(PlatformContext)
  if (!p) throw new Error('usePlatform must be used inside PlatformProvider')
  return p
}

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PlatformContext)?.portalContainer ?? undefined
}
