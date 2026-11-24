import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/state/HabitStore'

export function LoadingView() {
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto mt-24 flex max-w-sm flex-col gap-3 px-4">
      <span className="sr-only">Loading habits…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[132px] animate-pulse rounded-lg border border-border bg-surface" />
      ))}
    </div>
  )
}

export function ErrorView() {
  const { error, actions } = useStore()
  return (
    <div role="alert" className="mx-auto mt-24 flex max-w-sm flex-col items-center gap-3 px-4 text-center">
      <p className="text-body font-medium">Couldn't load your habits</p>
      <p className="text-small text-text-muted">{error}</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={() => void actions.reload()}>Try again</Button>
        <Button variant="danger-ghost" onClick={() => void actions.resetAll()}>
          Reset saved data
        </Button>
      </div>
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-14 text-center">
      <EmptyGraphic />
      <p className="mt-5 text-body font-medium text-text">{title}</p>
      <p className="mt-1 max-w-[340px] text-small text-text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** A tiny 7×4 grid hinting at what a filled graph will look like. */
function EmptyGraphic() {
  const filled = new Set([9, 10, 16, 17, 18, 23, 24, 25, 26])
  return (
    <div aria-hidden className="grid grid-cols-7 gap-[3px]">
      {Array.from({ length: 28 }, (_, i) => (
        <span key={i} className={`size-2.5 rounded-[2px] ${filled.has(i) ? 'bg-heat-done/70' : 'bg-heat-empty'}`} />
      ))}
    </div>
  )
}
