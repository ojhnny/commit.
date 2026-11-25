import { isValidDateKey } from './dates'
import { UNITS } from './units'
import type { DateKey, SchedulePreset, UnitId, Weekday } from './types'

export const LIMITS = {
  nameMax: 60,
  descriptionMax: 280,
  noteMax: 500,
  customUnitMax: 20,
  targetMax: 100_000,
  valueMax: 100_000,
} as const

export type HabitKind = 'amount' | 'binary'

export interface HabitFormInput {
  name: string
  description: string
  kind: HabitKind
  target: string
  unit: UnitId
  customUnit: string
  preset: SchedulePreset
  customDays: Weekday[]
  startDate: DateKey
}

export type HabitFormErrors = Partial<Record<'name' | 'description' | 'target' | 'customUnit' | 'customDays' | 'startDate', string>>

/** Parses a user-entered number. Accepts "1.5" and "1,5". Returns null if invalid. */
export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.')
  if (trimmed === '') return null
  if (!/^\d*\.?\d+$|^\d+\.$/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function validateHabitForm(input: HabitFormInput): HabitFormErrors {
  const errors: HabitFormErrors = {}
  const name = input.name.trim()
  if (!name) errors.name = 'Give the habit a name.'
  else if (name.length > LIMITS.nameMax) errors.name = `Keep the name under ${LIMITS.nameMax} characters.`

  if (input.description.length > LIMITS.descriptionMax)
    errors.description = `Keep the description under ${LIMITS.descriptionMax} characters.`

  if (input.kind === 'amount') {
    const target = parseAmount(input.target)
    if (target === null) errors.target = 'Enter a number.'
    else if (target <= 0) errors.target = 'Target must be greater than 0.'
    else if (target > LIMITS.targetMax) errors.target = 'That target is too large.'
    else if (!UNITS[input.unit].allowsDecimals && !Number.isInteger(target))
      errors.target = `Use a whole number of ${UNITS[input.unit].label}.`

    if (input.unit === 'custom') {
      const cu = input.customUnit.trim()
      if (!cu) errors.customUnit = 'Name the unit, e.g. "papers".'
      else if (cu.length > LIMITS.customUnitMax) errors.customUnit = 'Keep the unit short.'
    }
  }

  if (input.preset === 'custom' && input.customDays.length === 0)
    errors.customDays = 'Pick at least one day.'

  if (!isValidDateKey(input.startDate)) errors.startDate = 'Pick a valid date.'

  return errors
}

export interface LogValidation {
  value: number | null
  error?: string
}

export function validateLogValue(raw: string, allowsDecimals: boolean): LogValidation {
  const value = parseAmount(raw)
  if (value === null) return { value: null, error: 'Enter a number.' }
  if (value < 0) return { value: null, error: 'Progress cannot be negative.' }
  if (value > LIMITS.valueMax) return { value: null, error: 'That value is too large.' }
  if (!allowsDecimals && !Number.isInteger(value)) return { value: null, error: 'Use a whole number.' }
  return { value: Math.round(value * 100) / 100 }
}
