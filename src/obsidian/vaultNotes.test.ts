import { describe, expect, it } from 'vitest'
import { makeSchedule } from '@/domain/scheduling'
import { createMemoryStorage, LocalStorageHabitRepository } from '@/services/localStorageRepository'
// Resolved to harness/vault-mock.ts by vitest.config.ts.
import { FileManager, MockVault } from 'obsidian'
import { VaultNotes } from './vaultNotes'
import { VaultHabitRepository } from './vaultRepository'

const goal = { targetValue: 1, unit: 'completion' as const, schedule: makeSchedule('daily') }

function setup() {
  const vault = new (MockVault as any)() as InstanceType<typeof MockVault>
  vault.eventDelay = 0
  const app = { vault, fileManager: new (FileManager as any)(vault), workspace: { getLeaf: () => ({ openFile: async () => {} }), onLayoutReady: (cb: () => void) => cb() } } as any
  const notes = new VaultNotes(app, 'commit/notes')
  notes.init()
  const data = new LocalStorageHabitRepository({ storage: createMemoryStorage() })
  const repo = new VaultHabitRepository(data, notes)
  return { vault, repo, data, notes }
}

describe('notes as vault files', () => {
  it('creates a markdown file per note in a folder named after the habit', async () => {
    const { vault, repo } = setup()
    const h = await repo.createHabit({ name: 'Machine Learning', startDate: '2026-11-01', goal })
    const note = await repo.createNote(h.id, { title: 'Study plan', body: '# Goal' })
    expect(note.id).toBe('commit/notes/Machine Learning/Study plan.md')
    expect(vault.files.get(note.id)).toBe('# Goal')
    const snap = await repo.load()
    expect(snap.habits[0]?.notesFolder).toBe('commit/notes/Machine Learning')
    expect(snap.notes).toEqual([expect.objectContaining({ id: note.id, habitId: h.id, title: 'Study plan', body: '# Goal' })])
  })

  it('untitled notes get Untitled file names but an empty title', async () => {
    const { vault, repo } = setup()
    const h = await repo.createHabit({ name: 'Gym', startDate: '2026-11-01', goal })
    const a = await repo.createNote(h.id, { title: '', body: '' })
    const b = await repo.createNote(h.id, { title: '', body: '' })
    expect([a.id, b.id]).toEqual(['commit/notes/Gym/Untitled.md', 'commit/notes/Gym/Untitled 2.md'])
    expect(a.title).toBe('')
    expect(vault.files.has(b.id)).toBe(true)
  })

  it('renames the file when the title changes and writes the body', async () => {
    const { vault, repo } = setup()
    const h = await repo.createHabit({ name: 'Gym', startDate: '2026-11-01', goal })
    const n = await repo.createNote(h.id, { title: '', body: '' })
    const renamed = await repo.updateNote(n.id, { title: 'Lifts: week 1', body: '- squat' })
    expect(renamed.id).toBe('commit/notes/Gym/Lifts week 1.md')
    expect(renamed.title).toBe('Lifts week 1')
    expect(vault.files.has(n.id)).toBe(false)
    expect(vault.files.get(renamed.id)).toBe('- squat')
    // Same file name: no rename.
    expect((await repo.updateNote(renamed.id, { title: 'Lifts week 1 ' })).id).toBe(renamed.id)
    // Taken name gets a number.
    await repo.createNote(h.id, { title: 'Plan', body: '' })
    expect((await repo.updateNote(renamed.id, { title: 'Plan' })).id).toBe('commit/notes/Gym/Plan 2.md')
    await expect(repo.updateNote('commit/notes/Gym/missing.md', { body: 'x' })).rejects.toThrow('Note not found')
  })

  it('deletes notes to the trash, and the folder with the habit', async () => {
    const { vault, repo } = setup()
    const a = await repo.createHabit({ name: 'A', startDate: '2026-11-01', goal })
    const b = await repo.createHabit({ name: 'B', startDate: '2026-11-01', goal })
    const n = await repo.createNote(a.id, { title: 'one', body: '' })
    await repo.createNote(a.id, { title: 'two', body: '' })
    await repo.createNote(b.id, { title: 'three', body: '' })
    await repo.deleteNote(n.id)
    expect(vault.trashed).toEqual([n.id])
    await repo.deleteHabit(a.id)
    expect((await repo.load()).notes.map((x) => x.title)).toEqual(['three'])
  })

  it('renames the folder with the habit, and follows folders moved in Obsidian', async () => {
    const { vault, repo, data } = setup()
    const h = await repo.createHabit({ name: 'Reading', startDate: '2026-11-01', goal })
    await repo.createNote(h.id, { title: 'List', body: 'x' })
    await repo.updateHabit(h.id, { name: 'Reading 2027' })
    expect(vault.files.has('commit/notes/Reading 2027/List.md')).toBe(true)
    expect((await data.load()).habits[0]?.notesFolder).toBe('commit/notes/Reading 2027')

    // The user moves the folder in the file explorer.
    const folder = vault.getAbstractFileByPath('commit/notes/Reading 2027')!
    vault.move(folder, 'Books/Reading')
    await new Promise((r) => setTimeout(r, 10))
    expect((await data.load()).habits[0]?.notesFolder).toBe('Books/Reading')
    expect((await repo.load()).notes.map((n) => n.id)).toEqual(['Books/Reading/List.md'])
  })

  it('two habits with the same name get separate folders', async () => {
    const { repo } = setup()
    const a = await repo.createHabit({ name: 'Run', startDate: '2026-11-01', goal })
    const b = await repo.createHabit({ name: 'Run', startDate: '2026-11-01', goal })
    await repo.createNote(a.id, { title: 'a', body: '' })
    const nb = await repo.createNote(b.id, { title: 'b', body: '' })
    expect(nb.id).toBe('commit/notes/Run 2/b.md')
    const notes = (await repo.load()).notes
    expect(notes.find((n) => n.title === 'a')?.habitId).toBe(a.id)
    expect(notes.find((n) => n.title === 'b')?.habitId).toBe(b.id)
  })

  it('a web backup with notes restores them as files; vault backups leave notes out', async () => {
    const { vault, repo } = setup()
    const backup = {
      app: 'commit', version: 1, exportedAt: 'x',
      habits: [{ id: 'h1', name: 'ML', startDate: '2026-11-01', goalVersions: [{ ...goal, effectiveDate: '2026-11-01' }], order: 0, createdAt: 'x', updatedAt: 'x', archivedAt: null }],
      logs: [],
      notes: [{ id: 'n1', habitId: 'h1', title: 'Plan', body: '# hi', createdAt: 'x', updatedAt: 'x' }],
    }
    await repo.importData(backup)
    expect(vault.files.get('commit/notes/ML/Plan.md')).toBe('# hi')
    const exported = await repo.exportData()
    expect(exported.notes).toBeUndefined()
  })

  it('sample data notes become files and leave the JSON', async () => {
    const { vault, repo, data } = setup()
    await repo.loadSampleData()
    expect([...vault.files.keys()].filter((k) => k.endsWith('.md')).sort()).toEqual([
      'commit/notes/Machine Learning/Resources.md',
      'commit/notes/Machine Learning/Study plan.md',
      'commit/notes/Reading/2026 reading list.md',
    ])
    expect((await data.load()).notes).toEqual([])
    expect((await repo.load()).notes).toHaveLength(3)
    await repo.removeSampleData()
    expect((await repo.load()).notes).toHaveLength(0)
  })

  it('parallel loads move sample notes to files only once', async () => {
    const { vault, repo, data } = setup()
    await data.loadSampleData()
    await Promise.all([repo.load(), repo.load(), repo.load()])
    expect([...vault.files.keys()].filter((k) => k.endsWith('.md'))).toHaveLength(3)
    const a = await repo.createHabit({ name: 'Same', startDate: '2026-11-01', goal })
    await Promise.all([repo.createNote(a.id, { title: 'x', body: '' }), repo.createNote(a.id, { title: 'y', body: '' })])
    expect((await data.load()).habits.find((h) => h.id === a.id)?.notesFolder).toBe('commit/notes/Same')
    expect(vault.files.has('commit/notes/Same/x.md') && vault.files.has('commit/notes/Same/y.md')).toBe(true)
  })

  it('announces changes made outside commit. but not its own writes', async () => {
    const { vault, repo, notes } = setup()
    let calls = 0
    notes.subscribe(() => calls++)
    const h = await repo.createHabit({ name: 'A', startDate: '2026-11-01', goal })
    const n = await repo.createNote(h.id, { title: 'x', body: '' })
    await repo.updateNote(n.id, { body: 'mine' })
    await new Promise((r) => setTimeout(r, 250))
    expect(calls).toBe(0)
    vault.externalWrite('commit/notes/A/other.md', 'from sync')
    await new Promise((r) => setTimeout(r, 250))
    expect(calls).toBe(1)
  })
})
