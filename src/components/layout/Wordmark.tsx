import { cn } from '@/lib/utils'

/** The commit. wordmark: primary text + green period. No icon (DESIGN.md §1). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-[20px] leading-7 font-semibold tracking-[-0.02em] text-text', className)}>
      commit<span className="text-green">.</span>
    </span>
  )
}
