/**
 * Core data model for commit.
 *
 * Pure TypeScript: no React, DOM or storage imports. This module (and the rest of
 * `domain/`) is intended to be shared unchanged with a future React Native app and
 * to mirror the planned backend schema (Habits, HabitGoalVersions, HabitLogs).
 */

/** A local calendar day formatted as `YYYY-MM-DD`. */
export type DateKey = string

/** 0 = Sunday … 6 = Saturday (matches `Date#getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type SchedulePreset = 'daily' | 'weekdays' | 'weekends' | 'custom'

export interface Schedule {
  preset: SchedulePreset
  /** Resolved set of scheduled weekdays, sorted ascending. Always populated. */
  days: Weekday[]
}

/** Label color a habit can carry (DESIGN.md §4 Habit colors). Stored by name, never as a hex value. */
export type HabitColor = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink'

export type UnitId =
  | 'minutes'
  | 'hours'
  | 'problems'
  | 'pages'
  | 'workouts'
  | 'sessions'
  | 'tasks'
  | 'completion'
  | 'custom'

/**
 * The rules a habit was judged by from `effectiveDate` onward.
 * A new version is appended whenever target, unit or schedule changes.
 */
export interface GoalVersion {
  effectiveDate: DateKey
  targetValue: number
  unit: UnitId
  /** Label used when `unit === 'custom'`, e.g. "papers". */
  customUnit?: string
  schedule: Schedule
}

export interface Habit {
  id: string
  name: string
  description?: string
  startDate: DateKey
  /** Sorted by `effectiveDate` ascending. Never empty. */
  goalVersions: GoalVersion[]
  /** Manual sort position on the dashboard (ascending). */
  order: number
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  /** Marks prototype sample data so it can be removed in one action. */
  isSample?: boolean
  /** Optional label color, shown as a dot by the name. */
  color?: HabitColor
  /** Obsidian plugin only: vault folder that holds this habit's note files. */
  notesFolder?: string
}

export interface HabitLog {
  id: string
  habitId: string
  date: DateKey
  /** Recorded amount in the unit of the goal version that applies on `date`. */
  value: number
  note?: string
  createdAt: string
  updatedAt: string
}

/** A markdown note attached to a habit (several per habit, like documents in a folder). */
export interface HabitNote {
  id: string
  habitId: string
  /** May be empty; shown as "Untitled". */
  title: string
  /** Markdown source. */
  body: string
  createdAt: string
  updatedAt: string
}

/**
 * Derived state of one day for one habit. Never persisted.
 *
 * - `future`       date is after today
 * - `before-start` date is before the habit's start date
 * - `rest`         not a scheduled day (and nothing logged)
 * - `pending`      today, scheduled, nothing logged yet
 * - `missed`       past scheduled day with no progress
 * - `partial`      0 < value < target
 * - `done`         value === target
 * - `exceeded`     value > target
 */
export type DayStatus =
  | 'future'
  | 'before-start'
  | 'rest'
  | 'pending'
  | 'missed'
  | 'partial'
  | 'done'
  | 'exceeded'

export interface DayEvaluation {
  date: DateKey
  status: DayStatus
  value: number
  goal: GoalVersion
  scheduled: boolean
  /** True when the day counts toward consistency (eligible scheduled day). */
  eligible: boolean
  /** value / target, 0..∞ */
  ratio: number
  note?: string
}
