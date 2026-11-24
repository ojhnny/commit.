import { Check, Plus, RotateCcw } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { heatLevel } from '@/design/tokens'
import { evaluateDay } from '@/domain/progress'
import type { DateKey, GoalVersion, Habit, HabitLog } from '@/domain/types'
import { formatNumber, formatProgress, isBinary, UNITS, unitLabel } from '@/domain/units'
import { LIMITS, validateLogValue } from '@/domain/validation'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, Textarea } from '@/components/ui/input'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Segmented } from '@/components/ui/segmented'
import { StatusDot } from '@/components/heatmap/StatusDot'
import { describeDay } from '@/components/heatmap/describe'
import { useStore } from '@/state/HabitStore'
import { cn } from '@/lib/utils'

interface ProgressLoggerProps {
  habit: Habit
  date: DateKey
  log: HabitLog | undefined
  onSaved?: () => void
  /** Hide the status header (when the container already shows it). */
  hideHeader?: boolean
  autoFocus?: boolean
  /** `wide` puts the amount and note side by side on larger screens (habit page). */
  layout?: 'stack' | 'wide'
}

/** One-tap increments that fit the unit, e.g. +15 / +30 / +60 minutes. */
function quickAmounts(unit: GoalVersion['unit'], target: number): number[] {
  if (unit === 'minutes') return [15, 30, 60]
  if (unit === 'hours') return [0.25, 0.5, 1]
  if (target <= 3) return [1]
  return [...new Set([1, Math.round(target / 4), Math.round(target / 2)].filter((n) => n >= 1))]
}

type Mode = 'add' | 'set'

/**
 * Logs progress for one habit on one day. Used for today on the habit page,
 * and inside the day sheet for past days. One entry per day: saving replaces
 * ("Set total") or increments ("Add") that day's single record.
 */
export function ProgressLogger({ habit, date, log, onSaved, hideHeader, autoFocus, layout = 'stack' }: ProgressLoggerProps) {
  const wide = layout === 'wide'
  const { today, actions } = useStore()
  const day = evaluateDay(habit, log, date, today)
  const goal = day.goal
  const binary = isBinary(goal)
  const current = log?.value ?? 0
  const unit = goal.unit === 'custom' ? { ...UNITS.custom, label: unitLabel(goal, 2) } : UNITS[goal.unit]

  const ids = { amount: useId(), note: useId(), err: useId(), help: useId() }
  // Adding is natural while today is in progress; editing a past day usually means correcting its total.
  const [mode, setMode] = useState<Mode>(date === today && current > 0 ? 'add' : 'set')
  const [raw, setRaw] = useState('')
  const [note, setNote] = useState(log?.note ?? '')
  const [error, setError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  // Reset when switching to another habit/day or when the stored entry changes.
  useEffect(() => {
    setNote(log?.note ?? '')
    setRaw('')
    setError(undefined)
  }, [habit.id, date, log?.note, log?.value])

  const noteDirty = note.trim() !== (log?.note ?? '')
  const parsed = raw.trim() ? validateLogValue(raw, unit.allowsDecimals) : null
  const nextTotal = parsed?.value != null ? (mode === 'add' ? current + parsed.value : parsed.value) : null
  const isToday = date === today

  async function persist(value: number, message: string) {
    setSaving(true)
    const ok = await actions.logWithUndo(habit.id, date, { value: Math.round(value * 100) / 100, note: note.trim() || undefined }, message)
    setSaving(false)
    if (ok) {
      setRaw('')
      onSaved?.()
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (binary) return
    if (!raw.trim()) {
      if (noteDirty) await persist(current, 'Note saved')
      return
    }
    const result = validateLogValue(raw, unit.allowsDecimals)
    if (result.value === null) {
      setError(result.error)
      return
    }
    setError(undefined)
    const total = mode === 'add' ? current + result.value : result.value
    await persist(total, `Saved · ${formatProgress(goal, Math.round(total * 100) / 100)}`)
  }

  const complete = day.status === 'done' || day.status === 'exceeded'
  const d = describeDay(day)
  const barLevel = heatLevel(day.status) === 'exceeded' ? 'done' : heatLevel(day.status)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {!hideHeader && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <div className="tabular text-[18px] leading-6 font-medium tracking-tight">
              {binary ? (complete ? 'Done' : 'Not done yet') : formatProgress(goal, current)}
            </div>
            {!binary && <div className="tabular text-small text-text-muted">{Math.round(day.ratio * 100)}%</div>}
          </div>
          {!binary && <ProgressBar ratio={day.ratio} level={barLevel} label={`Progress ${formatProgress(goal, current)}`} />}
          <div className="flex items-center gap-1.5 text-small text-text-muted">
            <StatusDot status={day.status} />
            {d.status}
            {day.status === 'exceeded' && !binary ? (
              <span className="tabular">· +{formatNumber(current - goal.targetValue)} over</span>
            ) : null}
          </div>
        </div>
      )}

      <div className={cn('flex flex-col gap-4', wide && 'md:grid md:grid-cols-2 md:items-start md:gap-6')}>
      {binary ? (
        <Button
          variant={complete ? 'secondary' : 'primary'}
          size="lg"
          className="w-full"
          disabled={saving}
          onClick={() => persist(complete ? 0 : 1, complete ? 'Marked as not done' : 'Marked complete')}
        >
          {complete ? (
            <>
              <RotateCcw /> Undo completion
            </>
          ) : (
            <>
              <Check /> Mark complete
            </>
          )}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor={ids.amount}>{mode === 'add' ? 'Add progress' : `${isToday ? "Today's" : "Day's"} total`}</Label>
            <Segmented<Mode>
              size="sm"
              label="How to apply the amount"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'add', label: 'Add' },
                { value: 'set', label: 'Set total' },
              ]}
            />
          </div>
          <div className="relative">
            <Input
              id={ids.amount}
              type="text"
              inputMode={unit.allowsDecimals ? 'decimal' : 'numeric'}
              autoComplete="off"
              enterKeyHint="done"
              placeholder={mode === 'add' ? `e.g. ${formatNumber(unit.allowsDecimals ? unit.step * 2 : Math.max(1, Math.round(goal.targetValue / 2)))}` : formatNumber(current)}
              value={raw}
              autoFocus={autoFocus}
              onChange={(e) => {
                setRaw(e.target.value)
                if (error) setError(undefined)
              }}
              aria-invalid={Boolean(error) || Boolean(parsed?.error)}
              aria-describedby={`${ids.help} ${ids.err}`}
              className="tabular pr-20"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-small text-text-muted">
              {unit.label}
            </span>
          </div>
          <p id={ids.help} className="tabular min-h-[18px] text-small text-text-muted" aria-live="polite">
            {parsed?.error && raw ? null : nextTotal !== null ? (
              <>
                New total: <span className="text-text">{formatProgress(goal, Math.round(nextTotal * 100) / 100)}</span>
                {mode === 'set' && current > 0 ? ` (replaces ${formatNumber(current)})` : null}
              </>
            ) : mode === 'add' ? (
              `Adds to the current ${formatNumber(current)}.`
            ) : (
              `Replaces the day's total.`
            )}
          </p>
          <FieldError id={ids.err}>{error ?? (raw ? parsed?.error : undefined)}</FieldError>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick add">
            <span className="mr-0.5 text-small text-text-faint">Quick add</span>
            {quickAmounts(goal.unit, goal.targetValue).map((n) => (
              <Button
                key={n}
                size="sm"
                variant="outline"
                className="tabular h-7 px-2 touch:h-9"
                disabled={saving}
                aria-label={`Add ${formatNumber(n)} ${unitLabel(goal, n)}`}
                onClick={() => persist(current + n, `+${formatNumber(n)} · ${formatProgress(goal, Math.round((current + n) * 100) / 100)}`)}
              >
                +{formatNumber(n)}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.note}>
          Note <span className="font-normal text-text-faint">(optional)</span>
        </Label>
        <Textarea
          id={ids.note}
          rows={2}
          maxLength={LIMITS.noteMax}
          placeholder="What did you work on?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      </div>

      <div className={cn('flex flex-col gap-2 sm:flex-row', (binary || wide) && 'sm:justify-end')}>
        {!binary && (
          <>
            <Button type="submit" variant="primary" className={cn(!wide && 'sm:flex-1')} disabled={saving || (!raw.trim() && !noteDirty)}>
              <Plus className={cn(mode === 'set' && 'hidden')} />
              {mode === 'add' ? 'Add progress' : 'Save total'}
            </Button>
            {!complete && (
              <Button
                variant="accent"
                className={cn(!wide && 'sm:flex-1')}
                disabled={saving}
                onClick={() => persist(goal.targetValue, `Target reached · ${formatProgress(goal, goal.targetValue)}`)}
              >
                <Check /> Mark complete
              </Button>
            )}
          </>
        )}
        {binary && noteDirty && (
          <Button variant="secondary" disabled={saving} onClick={() => persist(current, 'Note saved')}>
            Save note
          </Button>
        )}
      </div>

      {log && (
        <button
          type="button"
          className="-mt-1 self-start text-small text-text-muted underline-offset-4 hover:text-text hover:underline"
          onClick={async () => {
            await actions.clearWithUndo(habit.id, date, 'Entry cleared')
            onSaved?.()
          }}
        >
          Clear this day's entry
        </button>
      )}
    </form>
  )
}
