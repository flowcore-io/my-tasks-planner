import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useState } from 'react'
import { useTasks, useReorderTasks } from '@/hooks/use-tasks'
import { TaskCard } from '@/components/tasks/TaskCard'
import { useToast } from '@/components/ui/Toast'
import type { TaskWithTags } from '../../../shared/types'
import { STATUS_ORDER, STATUS_LABELS } from '@/lib/utils'

interface KanbanViewProps {
  onTaskClick: (task: TaskWithTags) => void
  projectFilter?: string[]
}

export function KanbanView({ onTaskClick, projectFilter }: KanbanViewProps) {
  const { data: rawTasks, isLoading } = useTasks()

  // Client-side project filter
  const tasks = rawTasks && projectFilter && projectFilter.length > 0
    ? rawTasks.filter(t => t.projects.some(p => projectFilter.includes(p)))
    : rawTasks
  const reorder = useReorderTasks()
  const { toast } = useToast()
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  const columns = STATUS_ORDER.map(status => ({
    id: status,
    label: STATUS_LABELS[status],
    tasks: (tasks || [])
      .filter(t => t.status === status)
      .sort((a, b) => a.kanbanOrder - b.kanbanOrder),
  }))

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !tasks) return

    const { source, destination, draggableId } = result
    const sourceStatus = source.droppableId
    const destStatus = destination.droppableId

    // Build updates for all affected tasks
    const updates: { id: string; kanbanOrder?: number; status?: string }[] = []

    if (sourceStatus === destStatus) {
      // Reorder within same column
      const col = columns.find(c => c.id === sourceStatus)!
      const items = [...col.tasks]
      const [moved] = items.splice(source.index, 1)
      items.splice(destination.index, 0, moved)
      items.forEach((item, idx) => {
        updates.push({ id: item.id, kanbanOrder: idx })
      })
    } else {
      // Move between columns
      const sourceCol = columns.find(c => c.id === sourceStatus)!
      const destCol = columns.find(c => c.id === destStatus)!
      const sourceItems = [...sourceCol.tasks]
      const destItems = [...destCol.tasks]
      const [moved] = sourceItems.splice(source.index, 1)
      destItems.splice(destination.index, 0, moved)

      // Update moved task
      updates.push({ id: draggableId, status: destStatus, kanbanOrder: destination.index })

      // Reorder source column
      sourceItems.forEach((item, idx) => {
        updates.push({ id: item.id, kanbanOrder: idx })
      })
      // Reorder dest column
      destItems.forEach((item, idx) => {
        if (item.id !== draggableId) {
          updates.push({ id: item.id, kanbanOrder: idx })
        }
      })
    }

    // Only show spinner on the dragged task
    setSavingIds(new Set([draggableId]))

    // Filter out updates where nothing actually changed
    const filteredUpdates = updates.filter(u => {
      const existing = tasks.find(t => t.id === u.id)
      if (!existing) return true
      const kanbanChanged = u.kanbanOrder !== undefined && u.kanbanOrder !== existing.kanbanOrder
      const statusChanged = u.status !== undefined && u.status !== existing.status
      return kanbanChanged || statusChanged
    })

    if (filteredUpdates.length === 0) {
      setSavingIds(new Set())
      return
    }

    reorder.mutate(filteredUpdates, {
      onSettled: () => setSavingIds(new Set()),
      onError: () => toast({ title: 'Failed to reorder tasks', variant: 'error' }),
    })
  }

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 text-center py-8">Loading...</div>

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto overflow-y-auto pb-4">
        {columns.map(col => (
          <div key={col.id} className="flex-shrink-0 w-72">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{col.label}</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {col.tasks.length}
              </span>
            </div>
            <Droppable droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-2 min-h-[200px] p-2 rounded-lg transition-colors ${
                    snapshot.isDraggingOver
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'bg-gray-100/50 dark:bg-gray-800/30'
                  }`}
                >
                  {col.tasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={snapshot.isDragging ? 'opacity-90' : ''}
                        >
                          <TaskCard task={task} onClick={() => onTaskClick(task)} compact saving={savingIds.has(task.id)} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  )
}
