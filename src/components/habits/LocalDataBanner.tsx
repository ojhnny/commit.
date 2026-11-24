import { CloudUpload } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Habit, HabitLog } from '@/domain/types'
import { STORAGE_KEY } from '@/services/localStorageRepository'
import { useAccount } from '@/state/Account'
import { useStore } from '@/state/HabitStore'

const MOVED_KEY = 'commit-auth:local-moved'
const LATER_KEY = 'commit-auth:local-later'

/** Habits created in browser-only mode (sample habits aren't worth moving). */
function readLocalHabits(): { habits: Habit[]; logs: HabitLog[] } | null {
  try {
    if (window.localStorage.getItem(MOVED_KEY) || window.sessionStorage.getItem(LATER_KEY)) return null
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as { habits?: Habit[]; logs?: HabitLog[] }
    const habits = (state.habits ?? []).filter((h) => !h.isSample)
    if (!habits.length) return null
    const ids = new Set(habits.map((h) => h.id))
    return { habits, logs: (state.logs ?? []).filter((l) => ids.has(l.habitId)) }
  } catch {
    return null
  }
}

/** Offers to copy habits saved in this browser (before sign-in existed) into the account. */
export function LocalDataBanner() {
  const account = useAccount()
  const { actions } = useStore()
  const [local, setLocal] = useState(() => (account ? readLocalHabits() : null))
  const [busy, setBusy] = useState(false)
  if (!account || !local) return null

  const n = local.habits.length
  const move = async () => {
    setBusy(true)
    try {
      const r = await account.repository.mergeData({ app: 'commit', version: 1, exportedAt: new Date().toISOString(), ...local })
      // Keep the browser copy as a fallback, but never offer it twice.
      window.localStorage.setItem(MOVED_KEY, new Date().toISOString())
      await actions.reload()
      toast.success('Moved to your account', { description: `${r.habits} habits, ${r.logs} entries` })
      setLocal(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not move your habits.')
      setBusy(false)
    }
  }
  const later = () => {
    try {
      window.sessionStorage.setItem(LATER_KEY, '1')
    } catch {
      // Hidden until reload.
    }
    setLocal(null)
  }

  return (
    <section
      aria-label="Habits saved in this browser"
      className="mb-4 flex flex-col gap-3 rounded-lg border border-green/30 bg-green/5 p-4 sm:flex-row sm:items-center"
    >
      <CloudUpload aria-hidden className="hidden size-5 shrink-0 text-green sm:block" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-text">
          {n === 1 ? '1 habit is' : `${n} habits are`} saved only in this browser
        </p>
        <p className="mt-0.5 text-small text-text-muted">Move {n === 1 ? 'it' : 'them'} to your account to keep the history on every device.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={later} disabled={busy}>
          Not now
        </Button>
        <Button variant="primary" onClick={() => void move()} disabled={busy}>
          {busy ? 'Moving…' : 'Move to account'}
        </Button>
      </div>
    </section>
  )
}
