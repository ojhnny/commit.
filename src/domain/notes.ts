import type { HabitNote } from './types'

export const NOTE_TITLE_MAX = 120
export const NOTE_BODY_MAX = 100_000

export function displayTitle(note: Pick<HabitNote, 'title'>): string {
  return note.title.trim() || 'Untitled'
}

/** Newest edit first; ties broken by title so the order is stable. */
export function sortNotes(notes: readonly HabitNote[]): HabitNote[] {
  return [...notes].sort((a, b) => (a.updatedAt === b.updatedAt ? a.title.localeCompare(b.title) : a.updatedAt < b.updatedAt ? 1 : -1))
}

export function isEmptyNote(note: Pick<HabitNote, 'title' | 'body'>): boolean {
  return !note.title.trim() && !note.body.trim()
}

/** First line of readable text with markdown syntax removed, for list snippets. */
export function noteSnippet(body: string, max = 140): string {
  const lines = body
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/, '')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[\[([^\]|]*)\|?([^\]]*)\]\]/g, (_, a: string, b: string) => b || a)
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/(\*\*|__|\*|_|~~|`)/g, '')
        .replace(/^\s*([-*_]\s*){3,}$/, '')
        .trim(),
    )
    .filter(Boolean)
  const text = lines.join(' ').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Edited just now", "Edited 5m ago", "Edited 2h ago", "Edited Nov 20", "Edited Nov 20, 2025". */
export function formatEdited(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const diff = now.getTime() - then.getTime()
  if (Number.isNaN(diff)) return ''
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'Edited just now'
  if (min < 60) return `Edited ${min}m ago`
  const sameDay = then.toDateString() === now.toDateString()
  if (sameDay || min < 6 * 60) return `Edited ${Math.floor(min / 60)}h ago`
  const date = `${MONTHS[then.getMonth()]} ${then.getDate()}`
  return then.getFullYear() === now.getFullYear() ? `Edited ${date}` : `Edited ${date}, ${then.getFullYear()}`
}

/** Characters that can't appear in a file name on macOS, Windows, iOS or Android, or that Obsidian treats specially. */
// oxlint-disable-next-line no-control-regex
const UNSAFE = /[\\/:*?"<>|#^[\]\u0000-\u001f]/g

/** A note or habit name turned into a safe file/folder name (no extension). */
export function safeFileName(name: string, fallback = 'Untitled'): string {
  const cleaned = name.replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').replace(/[. ]+$/, '')
  return (cleaned || fallback).slice(0, NOTE_TITLE_MAX)
}
