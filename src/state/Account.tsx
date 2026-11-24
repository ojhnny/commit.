import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { App } from '@/App'
import { SignIn } from '@/pages/SignIn'
import { ApiClient, browserTimeZone, readSession, writeSession, type AccountUser, type StoredSession } from '@/services/apiClient'
import { HttpHabitRepository } from '@/services/httpRepository'

interface AccountValue {
  user: AccountUser
  repository: HttpHabitRepository
  signOut(): Promise<void>
}

/** Null when the app runs in browser-only mode (no VITE_API_URL). */
const AccountContext = createContext<AccountValue | null>(null)

export function useAccount(): AccountValue | null {
  return useContext(AccountContext)
}

/** Cloud mode: sign in first, then the normal app backed by the API. */
export function CloudRoot({ apiUrl }: { apiUrl: string }) {
  const [session, setSessionState] = useState<StoredSession | null>(readSession)
  const [notice, setNotice] = useState<string | null>(null)
  // Read by the API client on every request; updated together with `session`.
  const [auth] = useState(() => ({ token: session?.token ?? null }))

  const setSession = useCallback(
    (s: StoredSession | null) => {
      auth.token = s?.token ?? null
      setSessionState(s)
    },
    [auth],
  )

  const endSession = useCallback(
    (message: string | null) => {
      writeSession(null)
      setSession(null)
      setNotice(message)
    },
    [setSession],
  )

  const api = useMemo(
    () =>
      new ApiClient({
        baseUrl: apiUrl,
        getToken: () => auth.token,
        onUnauthorized: () => endSession('Your session expired. Sign in again.'),
      }),
    [apiUrl, auth, endSession],
  )
  const repository = useMemo(() => new HttpHabitRepository(api), [api])

  const start = useCallback(
    (s: StoredSession) => {
      writeSession(s)
      setSession(s)
      setNotice(null)
    },
    [setSession],
  )

  // Signing in or out in another tab applies here too.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === 'commit-auth:session') setSession(readSession())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [setSession])

  // "Today" is decided by the account's time zone; keep it matched to this device.
  const userId = session?.user.id
  const userTz = session?.user.timezone
  useEffect(() => {
    if (!userId) return
    const tz = browserTimeZone()
    if (tz === userTz) return
    api
      .request<AccountUser>('PATCH', '/auth/me', { timezone: tz })
      .then((user) => {
        const current = readSession()
        if (current) start({ ...current, user })
      })
      .catch(() => undefined)
  }, [api, userId, userTz, start])

  const value = useMemo<AccountValue | null>(
    () =>
      session && {
        user: session.user,
        repository,
        signOut: async () => {
          await api.request('POST', '/auth/logout').catch(() => undefined)
          endSession(null)
        },
      },
    [session, repository, api, endSession],
  )

  if (!value) return <SignIn api={api} onSignedIn={start} notice={notice} />
  return (
    <AccountContext.Provider value={value}>
      {/* Remount per account so nothing from a previous user lingers. */}
      <App key={value.user.id} repository={repository} />
    </AccountContext.Provider>
  )
}
