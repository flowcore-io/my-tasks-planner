import { useTasks, useBulkDeleteTasks, useBulkUpdateStatus } from '@/hooks/use-tasks'
import { StatusBadge } from '@/components/tasks/StatusBadge'
import { PriorityBadge } from '@/components/tasks/PriorityBadge'
import { TaskActions } from '@/components/tasks/TaskActions'
import { formatDate, STATUS_LABELS } from '@/lib/utils'
import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { TaskWithTags } from '../../../shared/types'

interface ListViewProps {
  filters?: { status?: string; priority?: string }
  onTaskClick: (task: TaskWithTags) => void
  projectFilter?: string[]
}

type SortKey = 'title' | 'status' | 'priority' | 'createdAt' | 'updatedAt'

export function ListView({ filters, onTaskClick, projectFilter }: ListViewProps) {
  const { data: rawTasks, isLoading } = useTasks(filters)

  // Client-side project filter
  const tasks = rawTasks && projectFilter && projectFilter.length > 0
    ? rawTasks.filter(t => t.projects.some(p => projectFilter.includes(p)))
    : rawTasks
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const bulkDelete = useBulkDeleteTasks()
  const bulkStatus = useBulkUpdateStatus()
  const { toast } = useToast()

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedTasks = [...(tasks || [])].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'title') cmp = a.title.localeCompare(b.title)
    else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
    else if (sortKey === 'priority') {
      const order = { urgent: 0, high: 1, medium: 2, low: 3 }
      cmp = (order[a.priority] ?? 2) - (order[b.priority] ?? 2)
    }
    else if (sortKey === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    else if (sortKey === 'updatedAt') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    return sortDir === 'asc' ? cmp : -cmp
  })

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === sortedTasks.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sortedTasks.map(t => t.id)))
    }
  }

  const handleBulkDelete = () => {
    const ids = [...selected]
    const count = ids.length
    setSelected(new Set())
    bulkDelete.mutate(ids, {
      onSuccess: () => toast({ title: `Deleted ${count} task${count > 1 ? 's' : ''}`, variant: 'success' }),
      onError: () => toast({ title: 'Failed to delete tasks', variant: 'error' }),
    })
  }

  const handleBulkStatus = (status: string) => {
    const ids = [...selected]
    const count = ids.length
    setSelected(new Set())
    bulkStatus.mutate({ ids, status }, {
      onSuccess: () => toast({ title: `Updated ${count} task${count > 1 ? 's' : ''}`, variant: 'success' }),
      onError: () => toast({ title: 'Failed to update tasks', variant: 'error' }),
    })
  }

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 text-center py-8">Loading tasks...</div>

  if (!sortedTasks.length) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <p className="text-gray-600 dark:text-gray-300 mb-2">No tasks yet</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Create your first task to get started</p>
      </div>
    )
  }

  const allSelected = selected.size === sortedTasks.length && sortedTasks.length > 0
  const someSelected = selected.size > 0

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
    >
      {label} {sortKey === field ? (sortDir === 'asc' ? ' ^' : ' v') : ''}
    </th>
  )

  return (
    <div className="space-y-0">
      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg mb-2">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {selected.size} selected
          </span>
          <div className="h-4 w-px bg-primary-300 dark:bg-primary-700" />
          <select
            defaultValue=""
            disabled={bulkStatus.isPending}
            onChange={e => { if (e.target.value) handleBulkStatus(e.target.value); e.target.value = '' }}
            className="text-sm px-2 py-1 rounded border border-primary-300 dark:border-primary-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-50"
          >
            <option value="" disabled>{bulkStatus.isPending ? 'Updating...' : 'Set status...'}</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDelete.isPending}
            className="flex items-center gap-1 text-sm text-danger-600 dark:text-danger-400 hover:text-danger-700 dark:hover:text-danger-300 transition-colors disabled:opacity-50"
          >
            {bulkDelete.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                  onChange={toggleAll}
                  className="rounded border-gray-300 dark:border-gray-500 text-primary-600 focus:ring-primary-500"
                />
              </th>
              <SortHeader label="Title" field="title" />
              <SortHeader label="Status" field="status" />
              <SortHeader label="Priority" field="priority" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tags</th>
              <SortHeader label="Created" field="createdAt" />
              <th className="w-10 px-2 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {sortedTasks.map(task => (
              <tr
                key={task.id}
                onClick={() => onTaskClick(task)}
                className={`cursor-pointer transition-colors ${
                  selected.has(task.id)
                    ? 'bg-primary-50 dark:bg-primary-900/10'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <td className="w-10 px-4 py-3" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(task.id)}
                    onChange={() => toggleSelect(task.id, { stopPropagation: () => {} } as React.MouseEvent)}
                    className="rounded border-gray-300 dark:border-gray-500 text-primary-600 focus:ring-primary-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{task.title}</span>
                </td>
                <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {[...new Set(task.tags)].map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(task.createdAt)}</td>
                <td className="w-10 px-2 py-3" onClick={e => e.stopPropagation()}>
                  <TaskActions taskId={task.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
