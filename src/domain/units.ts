import type { GoalVersion, UnitId } from './types'

export interface UnitDefinition {
  id: UnitId
  /** Plural label, e.g. "minutes". */
  label: string
  singular: string
  /** Short label for compact displays, e.g. "min". */
  short: string
  /** Whether decimal values make sense (hours: 1.5). */
  allowsDecimals: boolean
  /** Suggested step for numeric inputs. */
  step: number
}

export const UNITS: Record<UnitId, UnitDefinition> = {
  minutes: { id: 'minutes', label: 'minutes', singular: 'minute', short: 'min', allowsDecimals: false, step: 5 },
  hours: { id: 'hours', label: 'hours', singular: 'hour', short: 'h', allowsDecimals: true, step: 0.25 },
  problems: { id: 'problems', label: 'problems', singular: 'problem', short: 'problems', allowsDecimals: false, step: 1 },
  pages: { id: 'pages', label: 'pages', singular: 'page', short: 'pages', allowsDecimals: false, step: 1 },
  workouts: { id: 'workouts', label: 'workouts', singular: 'workout', short: 'workouts', allowsDecimals: false, step: 1 },
  sessions: { id: 'sessions', label: 'sessions', singular: 'session', short: 'sessions', allowsDecimals: false, step: 1 },
  tasks: { id: 'tasks', label: 'tasks', singular: 'task', short: 'tasks', allowsDecimals: false, step: 1 },
  completion: { id: 'completion', label: 'completion', singular: 'completion', short: '', allowsDecimals: false, step: 1 },
  custom: { id: 'custom', label: 'units', singular: 'unit', short: 'units', allowsDecimals: true, step: 1 },
}

export const UNIT_OPTIONS: UnitId[] = [
  'minutes', 'hours', 'problems', 'pages', 'workouts', 'sessions', 'tasks', 'custom',
]

/** Yes/no habits use the `completion` unit with a target of 1. */
export function isBinary(goal: Pick<GoalVersion, 'unit'>): boolean {
  return goal.unit === 'completion'
}

export function unitLabel(goal: Pick<GoalVersion, 'unit' | 'customUnit'>, value: number): string {
  if (goal.unit === 'custom') {
    const label = goal.customUnit?.trim() || 'units'
    // "1 paper" rather than "1 papers" for simple English plurals.
    return value === 1 && /[^s]s$/i.test(label) ? label.slice(0, -1) : label
  }
  const def = UNITS[goal.unit]
  return value === 1 ? def.singular : def.label
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  // Up to 2 decimals, trimmed.
  return String(Math.round(value * 100) / 100)
}

/** "2 hours", "3 problems", "1 workout", or "Done" for yes/no. */
export function formatAmount(goal: Pick<GoalVersion, 'unit' | 'customUnit'>, value: number): string {
  if (isBinary(goal)) return value >= 1 ? 'Done' : 'Not done'
  return `${formatNumber(value)} ${unitLabel(goal, value)}`
}

/** "2 hours / day" or "Once a day" for yes/no habits. */
export function formatTarget(goal: GoalVersion): string {
  if (isBinary(goal)) return 'Yes / no'
  return `${formatNumber(goal.targetValue)} ${unitLabel(goal, goal.targetValue)} / day`
}

/** "90 / 120 minutes" */
export function formatProgress(goal: GoalVersion, value: number): string {
  if (isBinary(goal)) return value >= 1 ? 'Done' : 'Not done'
  return `${formatNumber(value)} / ${formatNumber(goal.targetValue)} ${unitLabel(goal, goal.targetValue)}`
}
