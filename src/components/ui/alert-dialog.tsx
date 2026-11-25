import * as AD from '@radix-ui/react-alert-dialog'
import type { ReactNode } from 'react'
import { buttonVariants } from './button'
import { cn } from '@/lib/utils'
import { usePortalContainer } from '@/platform/Platform'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
}

/** Used only for irreversible actions (permanent delete). */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }: ConfirmDialogProps) {
  const container = usePortalContainer()
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      <AD.Portal container={container}>
        <AD.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
        <AD.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-[0_8px_24px_rgb(0_0_0/0.4)] data-[state=open]:animate-pop-in sm:p-6">
          <AD.Title className="text-[16px] leading-6 font-medium">{title}</AD.Title>
          <AD.Description className="mt-1.5 text-body text-text-muted">{description}</AD.Description>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AD.Cancel className={cn(buttonVariants({ variant: 'secondary' }))}>Cancel</AD.Cancel>
            <AD.Action className={cn(buttonVariants({ variant: 'danger' }))} onClick={onConfirm}>
              {confirmLabel}
            </AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  )
}
