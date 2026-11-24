import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-body font-medium transition-colors duration-150 select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-text text-bg hover:bg-white active:bg-text/90 disabled:bg-surface-3 disabled:text-text-faint disabled:opacity-100',
        secondary: 'border border-border bg-surface-2 text-text hover:bg-surface-3',
        ghost: 'text-text-muted hover:bg-surface-2 hover:text-text',
        outline: 'border border-border text-text hover:bg-surface-2',
        danger: 'bg-danger-strong text-white hover:bg-danger-strong/90',
        'danger-ghost': 'text-danger hover:bg-danger/10',
        accent: 'border border-green/40 bg-green/10 text-green hover:bg-green/15',
      },
      size: {
        sm: 'h-8 px-2.5 text-small touch:h-10',
        md: 'h-9 px-3.5 touch:h-11',
        lg: 'h-11 px-4',
        icon: 'size-9 touch:size-11',
        'icon-sm': 'size-8 touch:size-10',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    />
  )
}
