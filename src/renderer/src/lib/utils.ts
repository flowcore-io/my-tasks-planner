export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(date: Date | string | number): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const STATUS_LABELS: Record<string, string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done',
  'archived': 'Archived',
}

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const STATUS_ORDER = ['todo', 'in-progress', 'done', 'archived'] as const

export type ScheduleHealth = 'on-track' | 'at-risk' | 'overdue' | 'done' | 'no-deadline'

export function getScheduleHealth(task: { status: string; endDate?: string }): ScheduleHealth {
  if (task.status === 'done' || task.status === 'archived') return 'done'
  if (!task.endDate) return 'no-deadline'
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const end = new Date(task.endDate + 'T00:00:00')
  const diffMs = end.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 2) return 'at-risk'
  return 'on-track'
}

export function formatShortDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const LOCALSTORAGE_KEYS = {
  projectFilter: 'projectFilter',
  createdProjects: 'createdProjects',
} as const
