import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const fieldBase =
  'w-full rounded-md border border-border bg-surface-2 px-3 text-body text-text placeholder:text-text-faint transition-colors duration-150 hover:border-[#3a3d44] focus-visible:border-green/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/40 aria-[invalid=true]:border-danger/70 disabled:opacity-50'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(fieldBase, 'h-9 touch:h-11', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldBase, 'min-h-[72px] resize-none py-2', className)} {...props} />
}

export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(fieldBase, 'h-9 appearance-none pr-8 touch:h-11', className)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-text-muted"
      >
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('text-small font-medium text-text-muted', className)} {...props} />
}

export function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null
  return (
    <p id={id} className="text-small text-danger">
      {children}
    </p>
  )
}
