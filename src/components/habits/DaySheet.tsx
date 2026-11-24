import { formatDateMedium } from '@/domain/dates'
import { canLog, evaluateDay } from '@/domain/progress'
import type { DateKey, Habit } from '@/domain/types'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import { describeDay } from '@/components/heatmap/describe'
import { StatusDot } from '@/components/heatmap/StatusDot'
import { useHabitLogs, useStore } from '@/state/HabitStore'
import { ProgressLogger } from './ProgressLogger'

interface DaySheetProps {
  habit: Habit
  date: DateKey | null
  onClose: () => void
}

/** Details + editor for one day. Dialog on desktop, bottom sheet on phones. */
export function DaySheet({ habit, date, onClose }: DaySheetProps) {
  const { today } = useStore()
  const logs = useHabitLogs(habit.id)

  return (
    <ResponsiveDialog
      open={date !== null}
      onOpenChange={(o) => !o && onClose()}
      title={date ? (date === today ? `Today · ${formatDateMedium(date).replace(/,\s\d{4}$/, '')}` : formatDateMedium(date)) : ''}
      description={habit.name}
    >
      {date ? <DayBody habit={habit} date={date} today={today} logs={logs} onClose={onClose} /> : null}
    </ResponsiveDialog>
  )
}

function DayBody({
  habit,
  date,
  today,
  logs,
  onClose,
}: {
  habit: Habit
  date: DateKey
  today: DateKey
  logs: ReturnType<typeof useHabitLogs>
  onClose: () => void
}) {
  const log = logs.get(date)
  const day = evaluateDay(habit, log, date, today)
  const d = describeDay(day)

  if (!canLog(habit, date, today)) {
    return (
      <div className="flex flex-col gap-2 pb-2">
        <div className="flex items-center gap-2 text-body">
          <StatusDot status={day.status} />
          {d.status}
        </div>
        <p className="text-body text-text-muted">
          {day.status === 'future'
            ? "This day hasn't happened yet. You can log it once it arrives."
            : `This is before ${habit.name} started, so there's nothing to track.`}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {!day.scheduled && (
        <p className="rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-small text-text-muted">
          Rest day. It isn't scheduled, so it won't affect consistency or streaks. You can still log extra effort.
        </p>
      )}
      <ProgressLogger key={date} habit={habit} date={date} log={log} onSaved={onClose} />
    </div>
  )
}
