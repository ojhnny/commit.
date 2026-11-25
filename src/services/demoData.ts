import { addDays, eachDay } from '@/domain/dates'
import { goalFor, isScheduledOn, makeSchedule } from '@/domain/scheduling'
import type { DateKey, GoalVersion, Habit, HabitColor, HabitLog, HabitNote, Weekday } from '@/domain/types'

/**
 * Deterministic sample data, generated relative to the day it is first seeded and
 * then persisted (it never regenerates on refresh). Covers completed, missed,
 * partial, exceeded, rest days, a goal change, and a brand-new empty habit.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface SampleSpec {
  key: string
  name: string
  color?: HabitColor
  description?: string
  startOffset: number
  versions: { offset: number; goal: Omit<GoalVersion, 'effectiveDate'> }[]
  /** Probabilities for a scheduled past day. Remainder = missed. */
  rates: { done: number; exceeded: number; partial: number }
  /** Force the last N scheduled days (before today) to be complete. */
  tail: number
  /** Value logged for today, if any. */
  today?: number
  notes: string[]
  amounts: { done: (target: number, r: number) => number; exceeded: (t: number, r: number) => number; partial: (t: number, r: number) => number }
}

const minutesLike = {
  done: (t: number) => t,
  exceeded: (t: number, r: number) => Math.round(t * (1.15 + r * 0.6)),
  partial: (t: number, r: number) => Math.max(1, Math.round(t * (0.2 + r * 0.6))),
}
const hoursLike = {
  done: (t: number) => t,
  exceeded: (t: number, r: number) => Math.round(t * (1.15 + r * 0.6) * 4) / 4,
  partial: (t: number, r: number) => Math.max(0.25, Math.round(t * (0.2 + r * 0.6) * 4) / 4),
}
const countLike = {
  done: (t: number) => t,
  exceeded: (t: number, r: number) => t + 1 + Math.floor(r * Math.max(1, t)),
  partial: (t: number, r: number) => Math.max(1, Math.min(t - 1, Math.round(t * (0.3 + r * 0.5)))),
}
const binary = { done: () => 1, exceeded: () => 1, partial: () => 1 }

const SPECS: SampleSpec[] = [
  {
    key: 'ml',
    name: 'Machine Learning',
    color: 'blue',
    description: 'Study ML fundamentals and work through the deep learning course.',
    startOffset: -300,
    versions: [
      { offset: -300, goal: { targetValue: 1.5, unit: 'hours', schedule: makeSchedule('daily') } },
      { offset: -90, goal: { targetValue: 2, unit: 'hours', schedule: makeSchedule('daily') } },
    ],
    rates: { done: 0.5, exceeded: 0.18, partial: 0.17 },
    tail: 9,
    today: 1.5,
    notes: [
      'Backprop by hand. Finally clicked.',
      'Transformers chapter, attention math.',
      'Kaggle notebook on gradient boosting.',
      'Re-derived the bias-variance tradeoff.',
      'Short session, travel day.',
    ],
    amounts: hoursLike,
  },
  {
    key: 'leetcode',
    name: 'LeetCode',
    color: 'orange',
    description: 'Interview prep. Mix of mediums and one hard per week.',
    startOffset: -200,
    versions: [{ offset: -200, goal: { targetValue: 3, unit: 'problems', schedule: makeSchedule('weekdays') } }],
    rates: { done: 0.5, exceeded: 0.12, partial: 0.2 },
    tail: 4,
    notes: ['Two-pointer week.', 'Dynamic programming is slowly getting easier.', 'Graphs: Dijkstra + topo sort.'],
    amounts: countLike,
  },
  {
    key: 'reading',
    name: 'Reading',
    color: 'green',
    startOffset: -400,
    versions: [{ offset: -400, goal: { targetValue: 20, unit: 'pages', schedule: makeSchedule('daily') } }],
    rates: { done: 0.45, exceeded: 0.3, partial: 0.12 },
    tail: 23,
    today: 26,
    notes: ['Started "Designing Data-Intensive Applications".', 'Great chapter on replication.', 'Read on the train.'],
    amounts: countLike,
  },
  {
    key: 'gym',
    name: 'Gym',
    color: 'red',
    description: 'Strength training. Rest days are part of the plan.',
    startOffset: -150,
    versions: [
      { offset: -150, goal: { targetValue: 1, unit: 'completion', schedule: makeSchedule('custom', [1, 3, 5] as Weekday[]) } },
    ],
    rates: { done: 0.82, exceeded: 0, partial: 0 },
    tail: 5,
    notes: ['PR on deadlift.', 'Leg day.', 'Light session, shoulder felt off.'],
    amounts: binary,
  },
  {
    key: 'projects',
    name: 'Personal Projects',
    color: 'purple',
    startOffset: -120,
    versions: [{ offset: -120, goal: { targetValue: 60, unit: 'minutes', schedule: makeSchedule('daily') } }],
    rates: { done: 0.42, exceeded: 0.2, partial: 0.18 },
    tail: 2,
    today: 60,
    notes: ['Shipped the settings page.', 'Refactored the data layer.', 'Spike on offline sync.'],
    amounts: minutesLike,
  },
  {
    key: 'papers',
    name: 'Research Papers',
    color: 'teal',
    description: 'Read and summarize one paper.',
    startOffset: 0,
    versions: [
      { offset: 0, goal: { targetValue: 1, unit: 'custom', customUnit: 'papers', schedule: makeSchedule('weekdays') } },
    ],
    rates: { done: 0, exceeded: 0, partial: 0 },
    tail: 0,
    notes: [],
    amounts: countLike,
  },
]

/** Sample notes: [habit key, title, body, hours before the seed time]. */
const SAMPLE_NOTES: [string, string, string, number][] = [
  [
    'ml',
    'Study plan',
    `## Goal
Finish the deep learning course by spring and be able to explain every model I use.

## This month
- [x] Linear and logistic regression
- [x] Backpropagation, derived by hand
- [ ] Convolutional networks
- [ ] Attention and transformers

> Two focused hours beat four distracted ones.`,
    2,
  ],
  [
    'ml',
    'Resources',
    `- *Deep Learning* by Goodfellow, Bengio and Courville
- *The Elements of Statistical Learning*, chapters 3, 4 and 7
- [Distill](https://distill.pub) for visual explanations
- Kaggle notebooks on gradient boosting`,
    50,
  ],
  [
    'reading',
    '2026 reading list',
    `1. **Designing Data-Intensive Applications** (in progress)
2. The Pragmatic Programmer
3. Thinking, Fast and Slow

Rule: 20 pages before opening my phone in the morning.`,
    30,
  ],
]

export function buildSampleData(today: DateKey, timestamp: string): { habits: Habit[]; logs: HabitLog[]; notes: HabitNote[] } {
  const habits: Habit[] = []
  const logs: HabitLog[] = []

  SPECS.forEach((spec, order) => {
    const rand = mulberry32(order * 7919 + 2026)
    const id = `sample-${spec.key}`
    const startDate = addDays(today, spec.startOffset)
    const habit: Habit = {
      id,
      name: spec.name,
      description: spec.description,
      color: spec.color,
      startDate,
      goalVersions: spec.versions.map((v) => ({ ...v.goal, effectiveDate: addDays(today, v.offset) })),
      order,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
      isSample: true,
    }
    habits.push(habit)

    const yesterday = addDays(today, -1)
    const past = startDate <= yesterday ? eachDay(startDate, yesterday) : []
    // Identify the tail of scheduled days that should be complete (current streak).
    const scheduledPast = past.filter((d) => isScheduledOn(goalFor(habit, d).schedule, d))
    const tailSet = new Set(scheduledPast.slice(-spec.tail))

    const push = (date: DateKey, value: number, note?: string) => {
      logs.push({ id: `${id}-${date}`, habitId: id, date, value, note, createdAt: timestamp, updatedAt: timestamp })
    }

    // Slightly lower consistency early on, improving over time, like a real habit.
    for (let i = 0; i < past.length; i++) {
      const date = past[i]!
      const goal = goalFor(habit, date)
      const scheduled = isScheduledOn(goal.schedule, date)
      const r = rand()
      const r2 = rand()
      const noteRoll = rand()
      const note = spec.notes.length && noteRoll < 0.08 ? spec.notes[Math.floor(noteRoll * 1000) % spec.notes.length] : undefined
      if (!scheduled) {
        // Occasional bonus effort on a rest day.
        if (r < 0.06 && spec.key === 'gym') push(date, 1, 'Extra session.')
        continue
      }
      const t = goal.targetValue
      if (tailSet.has(date)) {
        push(date, r < 0.3 ? spec.amounts.exceeded(t, r2) : spec.amounts.done(t, r2), note)
        continue
      }
      const progressFactor = 0.85 + 0.15 * (i / Math.max(1, past.length))
      const { done, exceeded, partial } = spec.rates
      const x = r / progressFactor
      if (x < done) push(date, spec.amounts.done(t, r2), note)
      else if (x < done + exceeded) push(date, spec.amounts.exceeded(t, r2), note)
      else if (x < done + exceeded + partial) push(date, spec.amounts.partial(t, r2), note)
      // else: missed (no log)
    }

    if (spec.today !== undefined) push(today, spec.today)
  })

  const base = new Date(timestamp).getTime()
  const notes: HabitNote[] = SAMPLE_NOTES.map(([key, title, body, hoursAgo], i) => {
    const at = new Date(base - hoursAgo * 3_600_000).toISOString()
    return { id: `sample-note-${key}-${i}`, habitId: `sample-${key}`, title, body, createdAt: at, updatedAt: at }
  })

  return { habits, logs, notes }
}
