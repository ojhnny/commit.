import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from './apiClient'
import { RepositoryError } from './habitRepository'
import { HttpHabitRepository } from './httpRepository'

function mockFetch(handler: (url: string, init: RequestInit) => { status: number; body?: unknown }) {
  const calls: { url: string; init: RequestInit }[] = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const { status, body } = handler(url, init)
    return new Response(status === 204 ? null : JSON.stringify(body ?? null), { status })
  })
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('HttpHabitRepository', () => {
  const api = (onUnauthorized = () => undefined) =>
    new ApiClient({ baseUrl: 'https://api.test/', getToken: () => 'tok', onUnauthorized })

  it('sends the bearer token and maps nulls to undefined', async () => {
    const calls = mockFetch(() => ({
      status: 200,
      body: {
        habits: [
          {
            id: 'h', name: 'Read', description: null, startDate: '2026-11-01', order: 0, isSample: false,
            createdAt: 'x', updatedAt: 'x', archivedAt: null,
            goalVersions: [{ effectiveDate: '2026-11-01', targetValue: 1, unit: 'completion', customUnit: null, schedule: { preset: 'daily', days: [0, 1, 2, 3, 4, 5, 6] } }],
          },
        ],
        logs: [{ id: 'l', habitId: 'h', date: '2026-11-02', value: 1, note: null, createdAt: 'x', updatedAt: 'x' }],
      },
    }))
    const snap = await new HttpHabitRepository(api()).load()
    expect(calls[0]?.url).toBe('https://api.test/api/v1/snapshot')
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(snap.habits[0]?.description).toBeUndefined()
    expect(snap.habits[0]?.goalVersions[0]?.customUnit).toBeUndefined()
    expect(snap.logs[0]?.note).toBeUndefined()
  })

  it('upserts a day with PUT', async () => {
    const calls = mockFetch(() => ({ status: 200, body: { id: 'l', habitId: 'h', date: '2026-11-02', value: 30, createdAt: 'x', updatedAt: 'x' } }))
    await new HttpHabitRepository(api()).upsertLog('h', '2026-11-02', { value: 30 })
    expect(calls[0]?.init.method).toBe('PUT')
    expect(calls[0]?.url).toBe('https://api.test/api/v1/habits/h/logs/2026-11-02')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ value: 30 })
  })

  it('turns API errors into readable RepositoryErrors', async () => {
    mockFetch(() => ({ status: 422, body: { detail: 'Cannot log progress for a future date.' } }))
    await expect(new HttpHabitRepository(api()).upsertLog('h', '2099-01-01', { value: 1 })).rejects.toThrow('Cannot log progress for a future date.')
  })

  it('signs out on 401', async () => {
    const onUnauthorized = vi.fn()
    mockFetch(() => ({ status: 401, body: { detail: 'Your session expired. Sign in again.' } }))
    const err = await new HttpHabitRepository(api(onUnauthorized)).load().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RepositoryError)
    expect((err as RepositoryError).code).toBe('auth')
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('reports network failures', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(new HttpHabitRepository(api()).load()).rejects.toMatchObject({ code: 'network' })
  })

  it('rejects files that are not backups before uploading', async () => {
    const calls = mockFetch(() => ({ status: 200, body: {} }))
    await expect(new HttpHabitRepository(api()).importData({ hello: 1 })).rejects.toMatchObject({ code: 'invalid' })
    expect(calls).toHaveLength(0)
  })
})
