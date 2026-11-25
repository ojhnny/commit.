import { describe, expect, it } from 'vitest'
import { HABIT_COLORS, habitColorHex } from '@/domain/colors'
import { makeSchedule } from '@/domain/scheduling'
import { createMemoryStorage, LocalStorageHabitRepository } from './localStorageRepository'

const NOW = new Date(2026, 10, 24, 15, 0)
const goal = { targetValue: 30, unit: 'minutes' as const, schedule: makeSchedule('daily') }

describe('habit colors', () => {
  it('are eight distinct named colors', () => {
    expect(HABIT_COLORS).toHaveLength(8)
    expect(new Set(HABIT_COLORS.map((c) => c.hex)).size).toBe(8)
    expect(habitColorHex('teal')).toBe('#39C5CF')
    expect(habitColorHex('chartreuse')).toBeUndefined()
    expect(habitColorHex(undefined)).toBeUndefined()
  })

  it('are saved, changed, cleared, and survive a backup round trip', async () => {
    let n = 0
    const repo = new LocalStorageHabitRepository({ storage: createMemoryStorage(), now: () => NOW, newId: () => `c${++n}`, seedOnFirstRun: false })
    const h = await repo.createHabit({ name: 'Run', startDate: '2026-11-20', goal, color: 'blue' })
    expect(h.color).toBe('blue')
    expect((await repo.updateHabit(h.id, { name: 'Running' })).color).toBe('blue')
    expect((await repo.updateHabit(h.id, { color: 'pink' })).color).toBe('pink')
    const backup = await repo.exportData()
    expect((await repo.updateHabit(h.id, { color: null })).color).toBeUndefined()
    await repo.importData(backup)
    expect((await repo.load()).habits[0]!.color).toBe('pink')
  })
})
