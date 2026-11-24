import * as Menu from '@radix-ui/react-dropdown-menu'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu = Menu.Root
export const DropdownMenuTrigger = Menu.Trigger

export function DropdownMenuContent({ className, sideOffset = 6, align = 'end', ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={12}
        className={cn(
          'z-50 min-w-[200px] rounded-lg border border-border bg-surface p-1 shadow-[0_8px_24px_rgb(0_0_0/0.4)] data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  )
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: ComponentProps<typeof Menu.Item> & { destructive?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        'flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-body outline-none select-none touch:h-11 data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        destructive
          ? 'text-danger data-[highlighted]:bg-danger/10'
          : 'text-text data-[highlighted]:bg-surface-2 [&_svg]:text-text-muted',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('my-1 h-px bg-border-subtle', className)} {...props} />
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn('px-2 py-1.5 text-micro text-text-faint uppercase tracking-wide', className)} {...props} />
}
