import { useEffect, useState } from 'react'
import { toDateKey } from '@/domain/dates'
import type { DateKey } from '@/domain/types'

/**
 * The current local calendar day. Re-renders at local midnight so an unfinished
 * "today" turns into a missed day without a manual refresh, and when the tab
 * becomes visible again after sleeping.
 */
export function useToday(): DateKey {
  const [today, setToday] = useState(() => toDateKey(new Date()))

  useEffect(() => {
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
    const timer = window.setTimeout(() => setToday(toDateKey(new Date())), next.getTime() - now.getTime())
    const onVisible = () => {
      if (document.visibilityState === 'visible') setToday(toDateKey(new Date()))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [today])

  return today
}
