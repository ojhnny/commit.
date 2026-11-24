import { Info } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { WEEKDAY_INITIAL, WEEKDAY_LONG } from '@/domain/dates'
import { currentGoal, makeSchedule, normalizeSchedule } from '@/domain/scheduling'
import type { GoalVersion, Habit, SchedulePreset, UnitId, Weekday } from '@/domain/types'
import { UNIT_OPTIONS, UNITS } from '@/domain/units'
import { LIMITS, parseAmount, validateHabitForm, type HabitFormErrors, type HabitFormInput, type HabitKind } from '@/domain/validation'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, NativeSelect, Textarea } from '@/components/ui/input'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import { Segmented } from '@/components/ui/segmented'
import { useStore } from '@/state/HabitStore'
import { cn } from '@/lib/utils'

interface HabitFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog edits this habit. */
  habit?: Habit
}

function initialInput(habit: Habit | undefined, today: string): HabitFormInput {
  if (!habit) {
    return {
      name: '',
      description: '',
      kind: 'amount',
      target: '',
      unit: 'minutes',
      customUnit: '',
      preset: 'daily',
      customDays: [],
      startDate: today,
    }
  }
  const goal = currentGoal(habit, today)
  const binary = goal.unit === 'completion'
  return {
    name: habit.name,
    description: habit.description ?? '',
    kind: binary ? 'binary' : 'amount',
    target: binary ? '' : String(goal.targetValue),
    unit: binary ? 'minutes' : goal.unit,
    customUnit: goal.customUnit ?? '',
    preset: goal.schedule.preset,
    customDays: goal.schedule.days,
    startDate: habit.startDate,
  }
}

function toGoal(input: HabitFormInput): Omit<GoalVersion, 'effectiveDate'> {
  const schedule = normalizeSchedule(makeSchedule(input.preset, input.customDays))
  if (input.kind === 'binary') return { targetValue: 1, unit: 'completion', schedule }
  return {
    targetValue: parseAmount(input.target) ?? 1,
    unit: input.unit,
    customUnit: input.unit === 'custom' ? input.customUnit.trim() : undefined,
    schedule,
  }
}

export function HabitFormDialog({ open, onOpenChange, habit }: HabitFormDialogProps) {
  const { today, actions } = useStore()
  const navigate = useNavigate()
  const editing = Boolean(habit)
  const [input, setInput] = useState<HabitFormInput>(() => initialInput(habit, today))
  const [errors, setErrors] = useState<HabitFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const id = useId()
  const f = (name: string) => `${id}-${name}`

  useEffect(() => {
    if (open) {
      setInput(initialInput(habit, today))
      setErrors({})
    }
  }, [open, habit, today])

  const set = <K extends keyof HabitFormInput>(key: K, value: HabitFormInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }))
    if (errors[key as keyof HabitFormErrors]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const scheduleDays = makeSchedule(input.preset, input.customDays).days

  const toggleDay = (day: Weekday) => {
    const next = scheduleDays.includes(day) ? scheduleDays.filter((d) => d !== day) : [...scheduleDays, day]
    const normalized = normalizeSchedule(makeSchedule('custom', next))
    setInput((prev) => ({ ...prev, preset: next.length === 0 ? 'custom' : normalized.preset, customDays: normalized.days }))
    if (errors.customDays) setErrors((e) => ({ ...e, customDays: undefined }))
  }

  const goalChanged = (() => {
    if (!habit) return false
    const before = currentGoal(habit, today)
    const after = toGoal(input)
    return (
      before.targetValue !== after.targetValue ||
      before.unit !== after.unit ||
      (before.customUnit ?? '') !== (after.customUnit ?? '') ||
      before.schedule.days.join() !== after.schedule.days.join()
    )
  })()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validateHabitForm(input)
    setErrors(found)
    const firstKey = Object.keys(found)[0]
    if (firstKey) {
      document.getElementById(f(firstKey))?.focus()
      return
    }
    setSubmitting(true)
    if (habit) {
      const updated = await actions.updateHabit(habit.id, {
        name: input.name,
        description: input.description,
        startDate: input.startDate,
        goal: toGoal(input),
      })
      setSubmitting(false)
      if (updated) {
        toast.success('Habit updated')
        onOpenChange(false)
      }
    } else {
      const created = await actions.createHabit({
        name: input.name,
        description: input.description,
        startDate: input.startDate,
        goal: toGoal(input),
      })
      setSubmitting(false)
      if (created) {
        toast.success(`${created.name} created`)
        onOpenChange(false)
        navigate(`/habits/${created.id}`)
      }
    }
  }

  const unitDef = UNITS[input.unit]

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit habit' : 'New habit'}
      description={editing ? undefined : 'Track anything you want to get consistent at.'}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={f('name')}>Name</Label>
          <Input
            id={f('name')}
            autoFocus={!editing}
            autoComplete="off"
            placeholder="e.g. Machine Learning"
            maxLength={LIMITS.nameMax + 10}
            value={input.name}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? f('name-err') : undefined}
          />
          <FieldError id={f('name-err')}>{errors.name}</FieldError>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={f('description')}>
            Description <span className="font-normal text-text-faint">(optional)</span>
          </Label>
          <Textarea
            id={f('description')}
            rows={2}
            maxLength={LIMITS.descriptionMax}
            placeholder="Why it matters, or what counts"
            value={input.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-small font-medium text-text-muted" id={f('kind-label')}>
            Goal type
          </span>
          <Segmented<HabitKind>
            label="Goal type"
            className="w-full"
            value={input.kind}
            onChange={(v) => set('kind', v)}
            options={[
              { value: 'amount', label: 'Amount' },
              { value: 'binary', label: 'Yes / no' },
            ]}
          />
        </div>

        {input.kind === 'amount' ? (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={f('target')}>Daily target</Label>
                <Input
                  id={f('target')}
                  inputMode={unitDef.allowsDecimals ? 'decimal' : 'numeric'}
                  autoComplete="off"
                  placeholder={input.unit === 'hours' ? '2' : input.unit === 'minutes' ? '60' : '3'}
                  value={input.target}
                  onChange={(e) => set('target', e.target.value)}
                  aria-invalid={Boolean(errors.target)}
                  aria-describedby={errors.target ? f('target-err') : undefined}
                  className="tabular"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={f('unit')}>Unit</Label>
                <NativeSelect id={f('unit')} value={input.unit} onChange={(e) => set('unit', e.target.value as UnitId)}>
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u === 'custom' ? 'Custom…' : UNITS[u].label[0]!.toUpperCase() + UNITS[u].label.slice(1)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <FieldError id={f('target-err')}>{errors.target}</FieldError>
            {input.unit === 'custom' && (
              <div className="mt-1 flex flex-col gap-1.5">
                <Label htmlFor={f('customUnit')}>Unit name</Label>
                <Input
                  id={f('customUnit')}
                  placeholder="e.g. papers, km, reps"
                  maxLength={LIMITS.customUnitMax}
                  value={input.customUnit}
                  onChange={(e) => set('customUnit', e.target.value)}
                  aria-invalid={Boolean(errors.customUnit)}
                  aria-describedby={errors.customUnit ? f('customUnit-err') : undefined}
                />
                <FieldError id={f('customUnit-err')}>{errors.customUnit}</FieldError>
              </div>
            )}
          </div>
        ) : (
          <p className="-mt-1 text-small text-text-muted">Mark it done once a day. Good for workouts, meditation, or flossing.</p>
        )}

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-small font-medium text-text-muted">Repeat</legend>
          <Segmented<SchedulePreset>
            label="Repeat"
            size="sm"
            className="w-full"
            value={input.preset}
            onChange={(v) => {
              setInput((prev) => ({ ...prev, preset: v, customDays: v === 'custom' ? scheduleDays : makeSchedule(v).days }))
            }}
            options={[
              { value: 'daily', label: 'Every day' },
              { value: 'weekdays', label: 'Weekdays' },
              { value: 'weekends', label: 'Weekends' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          <div className="mt-1 grid grid-cols-7 gap-1" role="group" aria-label="Days of the week" id={f('customDays')} tabIndex={-1}>
            {WEEKDAY_INITIAL.map((label, i) => {
              const day = i as Weekday
              const on = scheduleDays.includes(day)
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_LONG[i]}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    'h-9 rounded-md border text-small font-medium transition-colors touch:h-11',
                    on
                      ? 'border-green/50 bg-green/15 text-text'
                      : 'border-border bg-surface-2 text-text-muted hover:text-text',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <FieldError id={f('customDays-err')}>{errors.customDays}</FieldError>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={f('startDate')}>Start date</Label>
          <Input
            id={f('startDate')}
            type="date"
            value={input.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            aria-invalid={Boolean(errors.startDate)}
            className="tabular [color-scheme:dark]"
          />
          <FieldError id={f('startDate-err')}>{errors.startDate}</FieldError>
        </div>

        {editing && goalChanged && (
          <p className="flex gap-2 rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-small text-text-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            The new target and schedule apply from today. Past days keep the goal they had, so your history won't change.
          </p>
        )}

        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {editing ? 'Save changes' : 'Create habit'}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  )
}
