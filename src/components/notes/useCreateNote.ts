import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Habit } from '@/domain/types'
import { useStore } from '@/state/HabitStore'

/** Creates an untitled note and opens it in the editor. */
export function useCreateNote(habit: Habit) {
  const { actions } = useStore()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const create = async () => {
    if (busy) return
    setBusy(true)
    const note = await actions.createNote(habit.id, { title: '', body: '' })
    setBusy(false)
    if (note) navigate(`/habits/${habit.id}/notes/${encodeURIComponent(note.id)}`, { state: { isNew: true } })
  }
  return { create, busy }
}

