import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn('mx-auto w-full max-w-[1040px] px-4 pb-16 sm:px-6 lg:px-8', className)}>{children}</main>
}

export function Section({ title, actions, children, className, id }: { title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section aria-labelledby={id} className={cn('rounded-lg border border-border bg-surface', className)}>
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border-subtle px-4 py-2">
        <h2 id={id} className="text-body font-medium text-text">
          {title}
        </h2>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}
