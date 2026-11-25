import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge our custom font-size tokens so `text-body` and `text-text`
// (a size and a color) are not treated as conflicting classes.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['micro', 'small', 'body', 'title'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
