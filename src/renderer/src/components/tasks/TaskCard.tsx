import { StatusBadge } from './StatusBadge'
import { PriorityBadge } from './PriorityBadge'
import { TaskActions } from './TaskActions'
import type { TaskWithTags } from '../../../../shared/types'

interface TaskCardProps {
  task: TaskWithTags
  onClick?: () => void
  compact?: boolean
  saving?: boolean
}

export function TaskCard({ task, onClick, compact, saving }: TaskCardProps) {
  return (
    <div
      onClick={onClick}
      className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 transition-colors shadow-sm"
    >
      {saving && (
        <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">{task.title}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <PriorityBadge priority={task.priority} />
          <TaskActions taskId={task.id} />
        </div>
      </div>
      {!compact && task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={task.status} />
        {[...new Set(task.tags)].map(tag => (
          <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
