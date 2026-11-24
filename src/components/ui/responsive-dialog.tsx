import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

interface ResponsiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Centered dialog on ≥640px, bottom sheet on phones (DESIGN.md §8–9).
 * Both are built on accessible primitives (Radix Dialog / Vaul).
 */
export function ResponsiveDialog({ open, onOpenChange, title, description, children, className }: ResponsiveDialogProps) {
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
          <Dialog.Content
            className={cn(
              'fixed top-[6vh] left-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-32px)] max-w-[440px] -translate-x-1/2 flex-col rounded-xl border border-border bg-surface shadow-[0_8px_24px_rgb(0_0_0/0.4)] focus:outline-none data-[state=open]:animate-pop-in',
              className,
            )}
            aria-describedby={description ? undefined : undefined}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
              <div className="min-w-0">
                <Dialog.Title className="text-[16px] leading-6 font-medium text-text">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-0.5 text-small text-text-muted">{description}</Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</Dialog.Description>
                )}
              </div>
              <Dialog.Close
                className="-mt-1 -mr-2 flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                aria-label="Close"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <div className="overflow-y-auto px-6 pt-1 pb-6">{children}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-xl border-t border-border bg-surface focus:outline-none',
            className,
          )}
        >
          <div aria-hidden className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-border" />
          <div className="flex items-start justify-between gap-3 px-4 pt-2 pb-3">
            <div className="min-w-0">
              <Drawer.Title className="text-[16px] leading-6 font-medium text-text">{title}</Drawer.Title>
              {description ? (
                <Drawer.Description className="mt-0.5 text-small text-text-muted">{description}</Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">{typeof title === 'string' ? title : 'Sheet'}</Drawer.Description>
              )}
            </div>
            <Drawer.Close
              className="-mt-1 -mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
              aria-label="Close"
            >
              <X className="size-5" />
            </Drawer.Close>
          </div>
          <div className="pb-safe overflow-y-auto px-4" data-vaul-no-drag>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
