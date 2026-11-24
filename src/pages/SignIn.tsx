import { useEffect, useId, useState, type FormEvent } from 'react'
import { Wordmark } from '@/components/layout/Wordmark'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { browserTimeZone, type ApiClient, type StoredSession } from '@/services/apiClient'

type Mode = 'signin' | 'signup'

// A fixed 4-week pattern in the heat colors, so the screen previews the app.
const PREVIEW = [0, 2, 3, 3, 1, 0, 3, 3, 4, 3, 0, 3, 2, 3, 3, 3, 4, 3, 1, 3, 3, 3, 3, 4, 3, 3, 0, 3]
const PREVIEW_CLASS = ['bg-heat-empty', 'bg-heat-missed', 'bg-heat-partial', 'bg-heat-done', 'bg-heat-exceeded']

export function SignIn({ api, onSignedIn, notice }: { api: ApiClient; onSignedIn: (s: StoredSession) => void; notice: string | null }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ids = { email: useId(), password: useId(), error: useId() }

  // Free hosting sleeps when idle; the first request can take a while.
  useEffect(() => {
    if (!busy) return
    const t = window.setTimeout(() => setSlow(true), 4000)
    return () => {
      window.clearTimeout(t)
      setSlow(false)
    }
  }, [busy])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (mode === 'signup' && password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }
    setBusy(true)
    try {
      const session = await api.request<StoredSession>('POST', mode === 'signin' ? '/auth/login' : '/auth/signup', {
        email: email.trim(),
        password,
        timezone: browserTimeZone(),
      })
      onSignedIn(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <main className="pt-safe mx-auto flex min-h-dvh w-full max-w-[380px] flex-col justify-center px-4 py-10">
      <div aria-hidden className="mb-6 grid w-max grid-flow-col grid-rows-7 gap-[3px]">
        {PREVIEW.map((level, i) => (
          <span key={i} className={`size-2.5 rounded-[2px] ${PREVIEW_CLASS[level]}`} />
        ))}
      </div>
      <h1 className="leading-none">
        <Wordmark className="text-[28px] leading-8" />
      </h1>
      <p className="mt-2 text-body text-text-muted">Build consistency, one day at a time.</p>

      <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
        <Segmented
          label="Account"
          value={mode}
          onChange={(m) => {
            setMode(m)
            setError(null)
          }}
          options={[
            { value: 'signin', label: 'Sign in' },
            { value: 'signup', label: 'Create account' },
          ]}
          className="w-full"
        />

        {notice && !error && <p className="rounded-md bg-orange/10 px-3 py-2 text-small text-orange">{notice}</p>}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={ids.email}>Email</Label>
          <Input
            id={ids.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={error ? ids.error : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={ids.password}>Password</Label>
          <Input
            id={ids.password}
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={error ? ids.error : undefined}
          />
          {mode === 'signup' && <p className="text-micro text-text-faint">At least 8 characters.</p>}
        </div>

        {error && (
          <p id={ids.error} role="alert" className="text-small text-danger">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" disabled={busy || !email.trim() || !password}>
          {busy ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
        {slow && (
          <p aria-live="polite" className="text-small text-text-muted">
            Waking up the server. On the free plan this can take up to a minute after it has been idle.
          </p>
        )}
      </form>

      <p className="mt-6 text-small text-text-faint">Your habits are saved to your account, so they're there on any device you sign in on.</p>
    </main>
  )
}
