import { ArrowLeft, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { displayTitle, isEmptyNote, NOTE_TITLE_MAX } from '@/domain/notes'
import type { Habit, HabitNote } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Segmented } from '@/components/ui/segmented'
import { useStore } from '@/state/HabitStore'
import { MarkdownPreview } from './MarkdownPreview'
import { useNoteHost } from './noteHost'

type Mode = 'write' | 'preview'
type SaveState = 'saved' | 'pending' | 'saving' | 'error'

const AUTOSAVE_MS = 600

interface Draft {
  title: string
  body: string
}

/**
 * Autosaving markdown editor for one note (DESIGN.md §8 Habit notes, §10 Notes).
 * Keeps its own draft; the store's copy only replaces it when there are no unsaved edits.
 */
export function NoteEditor({ habit, note }: { habit: Habit; note: HabitNote }) {
  const { actions } = useStore()
  const host = useNoteHost()
  const navigate = useNavigate()
  const location = useLocation()
  const isNew = (location.state as { isNew?: boolean } | null)?.isNew === true

  const [draft, setDraft] = useState<Draft>({ title: note.title, body: note.body })
  const [mode, setMode] = useState<Mode>(isNew || !note.body.trim() ? 'write' : 'preview')
  const [saveState, setSaveState] = useState<SaveState>('saved')

  const draftRef = useRef(draft)
  const savedRef = useRef<Draft>({ title: note.title, body: note.body })
  /** What storage last reported for this note. Storage may normalize a title (trimmed, or made file-name safe). */
  const storedRef = useRef<Draft>({ title: note.title, body: note.body })
  const idRef = useRef(note.id)
  const timer = useRef<number | undefined>(undefined)
  const inFlight = useRef<Promise<void> | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const deletedRef = useRef(false)
  const saveRef = useRef<() => Promise<void>>(async () => undefined)
  const listHref = `/habits/${habit.id}/notes`

  const save = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current)
    if (inFlight.current) await inFlight.current
    if (deletedRef.current) return
    const current = draftRef.current
    const saved = savedRef.current
    if (current.title === saved.title && current.body === saved.body) {
      setSaveState('saved')
      return
    }
    const patch: Partial<Draft> = {}
    if (current.title !== saved.title) patch.title = current.title
    if (current.body !== saved.body) patch.body = current.body
    setSaveState('saving')
    const run = (async () => {
      try {
        const result = await actions.updateNote(idRef.current, patch)
        savedRef.current = { title: patch.title ?? saved.title, body: patch.body ?? saved.body }
        storedRef.current = { title: result.title, body: result.body }
        if (result.id !== idRef.current) {
          idRef.current = result.id
          navigate(`${listHref}/${encodeURIComponent(result.id)}`, { replace: true })
        }
        const now = draftRef.current
        if (now.title === savedRef.current.title && now.body === savedRef.current.body) setSaveState('saved')
        else {
          // Typed during the save: save again shortly.
          setSaveState('pending')
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => void saveRef.current(), AUTOSAVE_MS)
        }
      } catch {
        setSaveState('error')
      }
    })()
    inFlight.current = run
    await run
    inFlight.current = null
  }, [actions, listHref, navigate])
  useLayoutEffect(() => {
    saveRef.current = save
  }, [save])

  const schedule = useCallback(() => {
    setSaveState('pending')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void save(), AUTOSAVE_MS)
  }, [save])

  // Take changes made elsewhere (another device, the vault) when nothing is unsaved here.
  // Our own saves come back as the stored version and are not treated as outside changes.
  useEffect(() => {
    idRef.current = note.id
    const stored = storedRef.current
    if (note.title === stored.title && note.body === stored.body) return
    storedRef.current = { title: note.title, body: note.body }
    const saved = savedRef.current
    const d = draftRef.current
    if (d.title === saved.title && d.body === saved.body && !inFlight.current) {
      savedRef.current = { title: note.title, body: note.body }
      draftRef.current = savedRef.current
      setDraft(savedRef.current)
    }
  }, [note.id, note.title, note.body])

  // Leaving the note: save what's left, and drop a note that never got any content.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      if (deletedRef.current) return
      const d = draftRef.current
      const id = idRef.current
      if (isEmptyNote(d)) {
        void (inFlight.current ?? Promise.resolve()).then(() => actions.deleteNote(id))
        return
      }
      const saved = savedRef.current
      if (d.title !== saved.title || d.body !== saved.body) void saveRef.current()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Saving before the tab closes.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void save()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [save])

  // Grow the textarea with its content so the page is the only scroll.
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [draft.body, mode])

  useEffect(() => {
    if (isNew) titleRef.current?.focus()
  }, [isNew])

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => {
      const next = { ...d, ...patch }
      draftRef.current = next
      return next
    })
    schedule()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      void save()
    }
  }

  const remove = async () => {
    window.clearTimeout(timer.current)
    const snapshot: HabitNote = { ...note, id: idRef.current, title: draftRef.current.title, body: draftRef.current.body }
    if (inFlight.current) await inFlight.current
    // The unmount handler must not save or delete it again.
    deletedRef.current = true
    const ok = await actions.deleteNoteWithUndo(snapshot, `${displayTitle(snapshot)} deleted`)
    if (ok) navigate(listHref, { replace: true })
    else deletedRef.current = false
  }

  const status =
    saveState === 'error' ? (
      <button type="button" onClick={() => void save()} className="rounded-sm text-small text-danger hover:underline">
        Couldn't save · Retry
      </button>
    ) : (
      <span className="text-small text-text-faint" aria-live="polite">
        {saveState === 'saved' ? 'Saved' : 'Saving…'}
      </span>
    )

  return (
    <section aria-label={`Note: ${displayTitle(draft)}`} className="rounded-lg border border-border bg-surface" onKeyDown={onKeyDown}>
      <header className="flex min-h-12 items-center gap-2 border-b border-border-subtle px-2 py-2">
        <Button asChild variant="ghost" size="sm" className="px-2">
          <Link to={listHref} aria-label="All notes">
            <ArrowLeft />
            <span className="max-[379px]:sr-only">All notes</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1" />
        <div className="max-sm:hidden">{status}</div>
        <Segmented<Mode>
          size="sm"
          label="Editor mode"
          value={mode}
          onChange={(m) => {
            if (m === 'preview') void save()
            setMode(m)
          }}
          options={[
            { value: 'write', label: 'Write' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Note options">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {host && (
              <>
                <DropdownMenuItem
                  onSelect={async () => {
                    await save()
                    host.open({ ...note, id: idRef.current, ...draftRef.current })
                  }}
                >
                  <ExternalLink /> {host.openLabel}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem destructive onSelect={() => void remove()}>
              <Trash2 /> Delete note
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="mx-auto w-full max-w-[720px] px-4 pt-4 pb-6 sm:px-6 sm:pt-5">
        <div className="mb-1 sm:hidden">{status}</div>
        <label htmlFor="note-title" className="sr-only">
          Title
        </label>
        <input
          id="note-title"
          ref={titleRef}
          value={draft.title}
          maxLength={NOTE_TITLE_MAX}
          placeholder="Untitled"
          autoComplete="off"
          onChange={(e) => update({ title: e.target.value })}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (mode === 'write') bodyRef.current?.focus()
              else {
                setMode('write')
                requestAnimationFrame(() => bodyRef.current?.focus())
              }
            }
          }}
          className="w-full rounded-md bg-transparent text-[18px] leading-7 font-semibold tracking-[-0.01em] text-text placeholder:text-text-faint focus-visible:outline-none sm:text-title"
        />
        <div className="mt-3">
          {mode === 'write' ? (
            <>
              <label htmlFor="note-body" className="sr-only">
                Note, in Markdown
              </label>
              <textarea
                id="note-body"
                ref={bodyRef}
                value={draft.body}
                placeholder="Write in Markdown…"
                spellCheck
                onChange={(e) => update({ body: e.target.value })}
                onBlur={() => void save()}
                className="block min-h-[320px] w-full resize-none overflow-hidden rounded-md bg-transparent text-body leading-[22px] text-text placeholder:text-text-faint focus-visible:outline-none"
              />
            </>
          ) : (
            <MarkdownPreview source={draft.body} className="min-h-[320px]" />
          )}
        </div>
      </div>
    </section>
  )
}
