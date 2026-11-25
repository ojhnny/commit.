import { MoreHorizontal, Plus, ExternalLink, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { displayTitle, formatEdited, noteSnippet } from '@/domain/notes'
import type { Habit, HabitNote } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/layout/StateViews'
import { useStore } from '@/state/HabitStore'
import { cn } from '@/lib/utils'
import { useNoteHost } from './noteHost'
import { useCreateNote } from './useCreateNote'

/** Re-renders every minute so "Edited 5m ago" stays true. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

/** Drive-style list of a habit's notes, newest edit first (DESIGN.md §8 Habit notes). */
export function NotesList({ habit, notes }: { habit: Habit; notes: readonly HabitNote[] }) {
  const { create, busy } = useCreateNote(habit)
  const now = useNow()

  const newButton = (
    <Button variant="primary" size="sm" onClick={() => void create()} disabled={busy} aria-label="New note" className="touch:h-11">
      <Plus />
      <span className="max-[379px]:sr-only">New note</span>
    </Button>
  )

  if (notes.length === 0) {
    return (
      <EmptyState
        title="No notes yet"
        body="Keep plans, resources and reflections for this habit. Notes are written in Markdown."
        action={newButton}
      />
    )
  }

  return (
    <section aria-labelledby="notes-heading" className="rounded-lg border border-border bg-surface">
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-border-subtle py-2 pr-2 pl-4">
        <h2 id="notes-heading" className="text-body font-medium text-text">
          Notes
          <span className="tabular ml-2 font-normal text-text-muted">{notes.length}</span>
        </h2>
        {newButton}
      </header>
      <ul className="divide-y divide-border-subtle">
        {notes.map((note) => (
          <NoteRow key={note.id} habit={habit} note={note} now={now} />
        ))}
      </ul>
    </section>
  )
}

function NoteRow({ habit, note, now }: { habit: Habit; note: HabitNote; now: Date }) {
  const { actions } = useStore()
  const host = useNoteHost()
  const navigate = useNavigate()
  const href = `/habits/${habit.id}/notes/${encodeURIComponent(note.id)}`
  const title = displayTitle(note)
  const snippet = noteSnippet(note.body)
  const edited = formatEdited(note.updatedAt, now)

  return (
    <li className="group relative flex items-start gap-2 py-3 pr-2 pl-4 transition-colors duration-150 hover:bg-[#191b1f] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-green">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className={cn('min-w-0 truncate text-body font-medium', note.title.trim() ? 'text-text' : 'text-text-muted')}>
            <Link to={href} className="outline-none after:absolute after:inset-0 after:content-['']">
              {title}
            </Link>
          </h3>
          <span className="tabular shrink-0 text-small text-text-faint max-[379px]:hidden">{edited}</span>
        </div>
        <p className={cn('mt-0.5 truncate text-small', snippet ? 'text-text-muted' : 'text-text-faint')}>{snippet || 'Empty note'}</p>
        <p className="tabular mt-0.5 text-micro text-text-faint min-[380px]:hidden">{edited}</p>
      </div>
      <div className="relative z-10 -my-1 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Options for ${title}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => navigate(href)}>Open</DropdownMenuItem>
            {host && (
              <DropdownMenuItem onSelect={() => host.open(note)}>
                <ExternalLink /> {host.openLabel}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => void actions.deleteNoteWithUndo(note, `${title} deleted`)}>
              <Trash2 /> Delete note
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}
