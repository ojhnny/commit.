import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { Habit } from '@/domain/types'
import { cn } from '@/lib/utils'

interface SortableHabitsProps {
  habits: readonly Habit[]
  layout: 'grid' | 'list'
  className?: string
  /** Called with the new order of these habits after a drop. */
  onReorder: (ids: string[]) => void
  children: (habit: Habit, handle: ReactNode) => ReactNode
}

/**
 * Drag-to-reorder list (DESIGN.md §8 Habit card). Only the grip starts a drag:
 * mouse after 4px of movement, touch after a short press (so scrolling never drags),
 * keyboard with Space / arrows / Space.
 */
export function SortableHabits({ habits, layout, className, onReorder, children }: SortableHabitsProps) {
  // Local order shown right after a drop, until the saved order comes back.
  const [pending, setPending] = useState<string[] | null>(null)
  useEffect(() => setPending(null), [habits])
  const byId = new Map(habits.map((h) => [h.id, h]))
  const ordered = pending ? pending.map((id) => byId.get(id)).filter((h): h is Habit => Boolean(h)) : habits
  const ids = ordered.map((h) => h.id)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    setPending(next)
    onReorder(next)
  }

  const name = (id: string | number) => byId.get(String(id))?.name ?? 'Habit'
  const position = (id: string | number | undefined) => (id === undefined ? 0 : ids.indexOf(String(id)) + 1)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={layout === 'list' ? [restrictToVerticalAxis] : undefined}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'To move a habit, press Space. Use the arrow keys to move it, Space to drop it, or Escape to cancel.',
        },
        announcements: {
          onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
          onDragOver: ({ active, over }) => (over ? `${name(active.id)} is at position ${position(over.id)} of ${ids.length}.` : undefined),
          onDragEnd: ({ active, over }) => (over ? `${name(active.id)} moved to position ${position(over.id)} of ${ids.length}.` : `${name(active.id)} dropped.`),
          onDragCancel: ({ active }) => `Move cancelled. ${name(active.id)} stayed in place.`,
        },
      }}
    >
      <SortableContext items={ids} strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}>
        <ul className={className} aria-label="Habits">
          {ordered.map((habit) => (
            <SortableItem key={habit.id} habit={habit}>
              {(handle) => children(habit, handle)}
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({ habit, children }: { habit: Habit; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id })
  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Move ${habit.name}`}
      aria-roledescription="drag handle"
      className={cn(
        'relative z-10 flex size-8 shrink-0 touch-none items-center justify-center rounded-md text-text-faint transition-colors hover:bg-surface-2 hover:text-text-muted touch:size-10',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  )
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-20 [&>*]:shadow-[0_8px_24px_rgb(0_0_0/0.45)] [&>*]:border-[#4a4e57]')}
    >
      {children(handle)}
    </li>
  )
}
