/**
 * commit. design tokens — the single source of truth for colors, type and spacing.
 *
 * Platform-neutral (plain values only) so a future React Native / Expo app can
 * import the same file. `src/styles/index.css` mirrors these values as CSS
 * variables for Tailwind; `tokens.test.ts` fails if the two drift apart.
 * See DESIGN.md §4–7.
 */
import type { DayStatus } from '@/domain/types'

export const colors = {
  bg: '#101113',
  surface: '#17191C',
  surface2: '#1B1E21',
  surface3: '#22252A',
  border: '#303238',
  borderSubtle: '#24272C',
  text: '#E7E9EC',
  textMuted: '#8D929B',
  textFaint: '#80858F',
  green: '#2DA44E',
  greenDark: '#116329',
  orange: '#DA8B36',
  danger: '#E5534B',
  dangerStrong: '#C0392F',
  timer: '#E8713F',
} as const

export const heat = {
  empty: '#25282D',
  missed: '#DA8B36',
  partial: '#397C46',
  done: '#2DA44E',
  exceeded: '#116329',
} as const

export type HeatLevel = keyof typeof heat

export function heatLevel(status: DayStatus): HeatLevel {
  switch (status) {
    case 'missed':
      return 'missed'
    case 'partial':
      return 'partial'
    case 'done':
      return 'done'
    case 'exceeded':
      return 'exceeded'
    default:
      return 'empty'
  }
}

export const typography = {
  fontFamily: 'Geist',
  monoFamily: 'Geist Mono',
  scale: {
    wordmark: { size: 20, lineHeight: 28, weight: 600 },
    title: { size: 20, lineHeight: 28, weight: 600 },
    section: { size: 14, lineHeight: 20, weight: 500 },
    body: { size: 14, lineHeight: 20, weight: 400 },
    small: { size: 13, lineHeight: 18, weight: 400 },
    micro: { size: 11, lineHeight: 14, weight: 400 },
    stat: { size: 20, lineHeight: 24, weight: 500 },
  },
} as const

export const spacing = [0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48] as const

export const radius = { cell: 2, control: 6, card: 8, dialog: 12 } as const

export const heatmapSize = {
  desktop: { cell: 11, gap: 3 },
  touch: { cell: 13, gap: 3 },
} as const

export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const
