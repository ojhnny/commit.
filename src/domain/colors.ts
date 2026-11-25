import type { HabitColor } from './types'

/** The eight label colors a habit can carry, in picker order (DESIGN.md §4 Habit colors). */
export const HABIT_COLORS: readonly { id: HabitColor; name: string; hex: string }[] = [
  { id: 'red', name: 'Red', hex: '#F47067' },
  { id: 'orange', name: 'Orange', hex: '#E0823D' },
  { id: 'yellow', name: 'Yellow', hex: '#D4B13F' },
  { id: 'green', name: 'Green', hex: '#57AB5A' },
  { id: 'teal', name: 'Teal', hex: '#39C5CF' },
  { id: 'blue', name: 'Blue', hex: '#539BF5' },
  { id: 'purple', name: 'Purple', hex: '#B083F0' },
  { id: 'pink', name: 'Pink', hex: '#E275AD' },
]

/** Hex for a habit's color, or undefined for none (or an unknown value from an old file). */
export function habitColorHex(color: string | undefined | null): string | undefined {
  return HABIT_COLORS.find((c) => c.id === color)?.hex
}

export function habitColorName(color: string | undefined | null): string | undefined {
  return HABIT_COLORS.find((c) => c.id === color)?.name
}
