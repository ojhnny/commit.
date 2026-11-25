import { describe, expect, it, vi, afterEach } from 'vitest'
import { displayTitle, formatEdited, isEmptyNote, noteSnippet, safeFileName, sortNotes } from '@/domain/notes'
import { makeSchedule } from '@/domain/scheduling'
import type { HabitNote } from '@/domain/types'
import { ApiClient } from './apiClient'
import { HttpHabitRepository } from './httpRepository'
import { createMemoryStorage, LocalStorageHabitRepository, STORAGE_KEY } from './localStorageRepository'

const NOW = new Date(2026, 10, 24, 15, 0)
let n = 0
let clock = NOW.getTime()
const make = () => {
  const storage = createMemoryStorage()
  const repo = new LocalStorageHabitRepository({ storage, now: () => new Date((clock += 1000)), newId: () => `id${++n}` })
  return { storage, repo }
}
const goal = { targetValue: 1, unit: 'completion' as const, schedule: makeSchedule('daily') }

describe('notes in the browser repository', () => {
  it('creates, edits, lists and deletes notes per habit', async () => {
    const { repo } = make()
    const a = await repo.createHabit({ name: 'ML', startDate: '2026-11-01', goal })
    const b = await repo.createHabit({ name: 'Gym', startDate: '2026-11-01', goal })
    const n1 = await repo.createNote(a.id, { title: ' Plan ', body: '# Week 1' })
    expect(n1.title).toBe('Plan')
    await repo.createNote(b.id, { title: 'Lifts', body: '' })
    const edited = await repo.updateNote(n1.id, { body: '# Week 2' })
    expect(edited).toMatchObject({ title: 'Plan', body: '# Week 2' })
    expect(edited.updatedAt > n1.updatedAt).toBe(true)
    expect((await repo.load()).notes.filter((x) => x.habitId === a.id)).toHaveLength(1)

    await repo.deleteNote(n1.id)
    expect((await repo.load()).notes.map((x) => x.title)).toEqual(['Lifts'])
    await expect(repo.updateNote('nope', { title: 'x' })).rejects.toThrow('Note not found')
    await expect(repo.createNote('nope', { title: '', body: '' })).rejects.toThrow('Habit not found')
    await expect(repo.createNote(a.id, { title: 'x'.repeat(121), body: '' })).rejects.toThrow('120')
  })

  it("deleting a habit deletes only that habit's notes", async () => {
    const { repo } = make()
    const a = await repo.createHabit({ name: 'A', startDate: '2026-11-01', goal })
    const b = await repo.createHabit({ name: 'B', startDate: '2026-11-01', goal })
    await repo.createNote(a.id, { title: 'a', body: '' })
    await repo.createNote(b.id, { title: 'b', body: '' })
    await repo.deleteHabit(a.id)
    expect((await repo.load()).notes.map((x) => x.title)).toEqual(['b'])
  })

  it('reads data saved before notes existed and imports old backups', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, habits: [], logs: [] }) })
    const repo = new LocalStorageHabitRepository({ storage })
    expect((await repo.load()).notes).toEqual([])
    await repo.importData({ app: 'commit', version: 1, exportedAt: 'x', habits: [], logs: [] })
    expect((await repo.load()).notes).toEqual([])
  })

  it('round-trips notes through a backup', async () => {
    const { repo } = make()
    const a = await repo.createHabit({ name: 'A', startDate: '2026-11-01', goal })
    await repo.createNote(a.id, { title: 'Plan', body: '- [ ] one' })
    const backup = JSON.parse(JSON.stringify(await repo.exportData()))
    expect(backup.notes).toHaveLength(1)
    const other = make().repo
    await other.importData(backup)
    expect((await other.load()).notes[0]).toMatchObject({ habitId: a.id, title: 'Plan', body: '- [ ] one' })
    await expect(other.importData({ ...backup, notes: [{ id: 1 }] })).rejects.toThrow('backup')
  })

  it('sample data includes notes that belong to sample habits', async () => {
    const storage = createMemoryStorage()
    const repo = new LocalStorageHabitRepository({ storage, now: () => NOW, seedOnFirstRun: true })
    const { habits, notes } = await repo.load()
    expect(notes.length).toBeGreaterThan(0)
    for (const note of notes) expect(habits.some((h) => h.id === note.habitId)).toBe(true)
    await repo.removeSampleData()
    expect((await repo.load()).notes).toEqual([])
  })
})

describe('note helpers', () => {
  const note = (title: string, updatedAt: string): HabitNote => ({ id: title, habitId: 'h', title, body: '', createdAt: updatedAt, updatedAt })

  it('sorts newest edit first', () => {
    expect(sortNotes([note('a', '2026-01-01'), note('b', '2026-03-01'), note('c', '2026-02-01')]).map((x) => x.title)).toEqual(['b', 'c', 'a'])
  })

  it('titles, emptiness and snippets', () => {
    expect(displayTitle({ title: '  ' })).toBe('Untitled')
    expect(isEmptyNote({ title: ' ', body: '\n' })).toBe(true)
    expect(noteSnippet('# Goal\n\n- [x] **Backprop** by [hand](http://x)\n> quote')).toBe('Goal Backprop by hand quote')
    expect(noteSnippet('```js\ncode()\n```\nAfter [[Link|alias]]')).toBe('After alias')
    expect(noteSnippet('x'.repeat(200)).length).toBe(140)
  })

  it('formats the edit time', () => {
    const now = new Date(2026, 10, 24, 15, 0)
    expect(formatEdited(new Date(2026, 10, 24, 14, 59, 30).toISOString(), now)).toBe('Edited just now')
    expect(formatEdited(new Date(2026, 10, 24, 14, 55).toISOString(), now)).toBe('Edited 5m ago')
    expect(formatEdited(new Date(2026, 10, 24, 9, 0).toISOString(), now)).toBe('Edited 6h ago')
    expect(formatEdited(new Date(2026, 10, 20, 9, 0).toISOString(), now)).toBe('Edited Nov 20')
    expect(formatEdited(new Date(2025, 10, 20, 9, 0).toISOString(), now)).toBe('Edited Nov 20, 2025')
  })

  it('makes safe file names', () => {
    expect(safeFileName('a/b: c?')).toBe('a b c')
    expect(safeFileName('  ...')).toBe('Untitled')
    expect(safeFileName('Plan.')).toBe('Plan')
    expect(safeFileName('#tag [x]')).toBe('tag x')
  })
})

describe('notes over HTTP', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('uses the notes endpoints', async () => {
    const calls: { url: string; method?: string; body?: unknown }[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method, body: init.body ? JSON.parse(String(init.body)) : undefined })
      const body = init.method === 'DELETE' ? null : { id: 'n1', habitId: 'h', title: 'T', body: 'B', createdAt: 'x', updatedAt: 'x' }
      return new Response(body ? JSON.stringify(body) : null, { status: body ? 200 : 204 })
    })
    const repo = new HttpHabitRepository(new ApiClient({ baseUrl: 'https://api.test', getToken: () => 't' }))
    await repo.createNote('h', { title: 'T', body: 'B' })
    await repo.updateNote('n1', { body: 'C' })
    await repo.deleteNote('n1')
    expect(calls.map((c) => `${c.method} ${c.url.replace('https://api.test/api/v1', '')}`)).toEqual(['POST /habits/h/notes', 'PATCH /notes/n1', 'DELETE /notes/n1'])
    expect(calls[1]?.body).toEqual({ body: 'C' })
  })
})
