import { RepositoryError } from './habitRepository'

export interface AccountUser {
  id: string
  email: string
  timezone: string
}

export interface StoredSession {
  token: string
  expiresAt: string
  user: AccountUser
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** FastAPI errors: `{detail: "text"}` or `{detail: [{msg, loc}, …]}` for validation. */
function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string; loc?: unknown[] }
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined
    if (first.msg) return field === 'password' ? 'Use at least 8 characters for your password.' : first.msg.replace(/^Value error, /, '')
  }
  return fallback
}

/**
 * Thin fetch wrapper for the commit. API. Every failure becomes a RepositoryError
 * with a message that can be shown to the user as-is.
 */
export class ApiClient {
  private readonly baseUrl: string
  private readonly getToken: () => string | null
  private readonly onUnauthorized: () => void

  constructor(options: { baseUrl: string; getToken?: () => string | null; onUnauthorized?: () => void }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.getToken = options.getToken ?? (() => null)
    this.onUnauthorized = options.onUnauthorized ?? (() => undefined)
  }

  async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {}
    const token = this.getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/api/v1${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new RepositoryError('network', "Couldn't reach the server. Check your connection and try again.")
    }

    if (res.status === 204) return undefined as T
    const data: unknown = await res.json().catch(() => null)
    if (res.ok) return data as T

    if (res.status === 401) {
      if (token) this.onUnauthorized()
      throw new RepositoryError('auth', errorMessage(data, 'Sign in to continue.'))
    }
    if (res.status === 404) throw new RepositoryError('not-found', errorMessage(data, 'Not found.'))
    if (res.status === 409 || res.status === 403 || res.status === 422 || res.status === 400) {
      throw new RepositoryError('invalid', errorMessage(data, 'That request was not accepted.'))
    }
    throw new RepositoryError('network', 'The server had a problem. Try again in a moment.')
  }
}

// ---------------------------------------------------------------- session storage

const SESSION_KEY = 'commit-auth:session'

export function readSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as StoredSession
    if (!s.token || !s.user || new Date(s.expiresAt).getTime() < Date.now()) return null
    return s
  } catch {
    return null
  }
}

export function writeSession(session: StoredSession | null): void {
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage blocked: the session lasts until the tab closes.
  }
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
