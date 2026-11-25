import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { colors, heat } from '@/design/tokens'
import { computeHabitStats } from '@/domain/stats'
import { indexLogs } from '@/domain/progress'
import { makeSchedule } from '@/domain/scheduling'
import { createMemoryStorage, LocalStorageHabitRepository, rebaseGoalVersions, STORAGE_KEY } from './localStorageRepository'

const NOW = new Date(2026, 10, 24, 15, 0) // Tue Nov 24 2026, local
let n = 0
const make = (seed = false) => {
  const storage = createMemoryStorage()
  const repo = new LocalStorageHabitRepository({ storage, now: () => NOW, newId: () => `id${++n}`, seedOnFirstRun: seed })
  return { storage, repo }
}

describe('LocalStorageHabitRepository', () => {
  it('seeds sample data once and never regenerates it', async () => {
    const { storage, repo } = make(true)
    const first = await repo.load()
    expect(first.habits.length).toBe(6)
    expect(first.logs.length).toBeGreaterThan(100)
    // Mutate and reload with a fresh repository over the same storage.
    await repo.deleteHabit('sample-gym')
    const again = new LocalStorageHabitRepository({ storage, now: () => NOW, seedOnFirstRun: true })
    expect((await again.load()).habits.length).toBe(5)
  })

  it('sample data covers every state', async () => {
    const { repo } = make(true)
    const { habits, logs } = await repo.load()
    const statuses = new Set<string>()
    const { evaluateRange } = await import('@/domain/progress')
    for (const h of habits) {
      const idx = indexLogs(logs.filter((l) => l.habitId === h.id))
      for (const d of evaluateRange(h, idx, h.startDate, '2026-11-24', '2026-11-24')) statuses.add(d.status)
    }
    for (const s of ['missed', 'partial', 'done', 'exceeded', 'rest', 'pending']) expect(statuses).toContain(s)
    const papers = habits.find((h) => h.id === 'sample-papers')!
    expect(logs.filter((l) => l.habitId === papers.id)).toHaveLength(0)
  })

  it('creates a habit with an empty history and keeps one log per day', async () => {
    const { repo } = make()
    const h = await repo.createHabit({
      name: '  Read ', startDate: '2026-11-24',
      goal: { targetValue: 20, unit: 'pages', schedule: makeSchedule('daily') },
    })
    expect(h.name).toBe('Read')
    await repo.upsertLog(h.id, '2026-11-24', { value: 5 })
    await repo.upsertLog(h.id, '2026-11-24', { value: 25, note: 'more' })
    const { logs } = await repo.load()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ value: 25, note: 'more' })
  })

  it('rejects future and pre-start logs', async () => {
    const { repo } = make()
    const h = await repo.createHabit({ name: 'X', startDate: '2026-11-20', goal: { targetValue: 1, unit: 'completion', schedule: makeSchedule('daily') } })
    await expect(repo.upsertLog(h.id, '2026-11-25', { value: 1 })).rejects.toThrow()
    await expect(repo.upsertLog(h.id, '2026-11-19', { value: 1 })).rejects.toThrow()
  })

  it('keeps habit histories independent', async () => {
    const { repo } = make()
    const a = await repo.createHabit({ name: 'A', startDate: '2026-11-20', goal: { targetValue: 1, unit: 'completion', schedule: makeSchedule('daily') } })
    const b = await repo.createHabit({ name: 'B', startDate: '2026-11-20', goal: { targetValue: 1, unit: 'completion', schedule: makeSchedule('daily') } })
    await repo.upsertLog(a.id, '2026-11-23', { value: 1 })
    await repo.upsertLog(b.id, '2026-11-23', { value: 0 })
    await repo.deleteHabit(b.id)
    const { logs } = await repo.load()
    expect(logs.map((l) => l.habitId)).toEqual([a.id])
  })

  it('versions goal edits from today and preserves past completions', async () => {
    const { repo } = make()
    const h = await repo.createHabit({ name: 'ML', startDate: '2026-11-20', goal: { targetValue: 60, unit: 'minutes', schedule: makeSchedule('daily') } })
    for (const d of ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']) await repo.upsertLog(h.id, d, { value: 60 })
    const updated = await repo.updateHabit(h.id, { goal: { targetValue: 120, unit: 'minutes', schedule: makeSchedule('daily') } })
    expect(updated.goalVersions.map((v) => [v.effectiveDate, v.targetValue])).toEqual([
      ['2026-11-20', 60],
      ['2026-11-24', 120],
    ])
    const { logs } = await repo.load()
    const stats = computeHabitStats(updated, indexLogs(logs), '2026-11-24')
    expect(stats.consistency).toBe(100)
    expect(stats.current).toBe(4)
  })

  it('archives, restores and reorders', async () => {
    const { repo } = make()
    const goal = { targetValue: 1, unit: 'completion' as const, schedule: makeSchedule('daily') }
    const a = await repo.createHabit({ name: 'A', startDate: '2026-11-24', goal })
    const b = await repo.createHabit({ name: 'B', startDate: '2026-11-24', goal })
    expect((await repo.archiveHabit(a.id)).archivedAt).not.toBeNull()
    expect((await repo.restoreHabit(a.id)).archivedAt).toBeNull()
    await repo.reorderHabits([b.id, a.id])
    const { habits } = await repo.load()
    expect(habits.sort((x, y) => x.order - y.order).map((h) => h.name)).toEqual(['B', 'A'])
  })

  it('removes only sample data', async () => {
    const { repo } = make(true)
    await repo.createHabit({ name: 'Mine', startDate: '2026-11-24', goal: { targetValue: 1, unit: 'completion', schedule: makeSchedule('daily') } })
    await repo.removeSampleData()
    const { habits, logs } = await repo.load()
    expect(habits.map((h) => h.name)).toEqual(['Mine'])
    expect(logs).toHaveLength(0)
  })

  it('round-trips a backup and rejects junk', async () => {
    const { repo } = make(true)
    const backup = JSON.parse(JSON.stringify(await repo.exportData()))
    const other = make().repo
    await other.importData(backup)
    expect((await other.load()).logs.length).toBe(backup.logs.length)
    await expect(other.importData({ hello: 1 })).rejects.toThrow('backup')
    expect((await other.load()).habits.length).toBe(6)
  })

  it('reports unreadable storage', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: '{oops' })
    const repo = new LocalStorageHabitRepository({ storage })
    await expect(repo.load()).rejects.toThrow('could not be read')
  })

  it('rebases goal versions when the start date moves', () => {
    const v = [
      { effectiveDate: '2026-01-01', targetValue: 1, unit: 'hours' as const, schedule: makeSchedule('daily') },
      { effectiveDate: '2026-03-01', targetValue: 2, unit: 'hours' as const, schedule: makeSchedule('daily') },
    ]
    expect(rebaseGoalVersions(v, '2025-12-01').map((x) => [x.effectiveDate, x.targetValue])).toEqual([['2025-12-01', 1], ['2026-03-01', 2]])
    expect(rebaseGoalVersions(v, '2026-04-01').map((x) => [x.effectiveDate, x.targetValue])).toEqual([['2026-04-01', 2]])
  })
})

describe('design tokens', () => {
  it('CSS theme mirrors tokens.ts', () => {
    const css = readFileSync(new URL('../styles/plugin.css', import.meta.url), 'utf8').toUpperCase()
    for (const hex of [...Object.values(colors), ...Object.values(heat)]) expect(css).toContain(hex.toUpperCase())
  })
})
