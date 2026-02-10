import { useState, useMemo, useRef, useEffect } from 'react'
import { useTasks, useBulkRenameProject, useBulkRemoveProject } from '@/hooks/use-tasks'
import { useCreateProject, useRemoveCreatedProject, useRenameCreatedProject, useProjects } from '@/hooks/use-projects'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { cn, STATUS_LABELS } from '@/lib/utils'
import { Pencil, Trash2, ArrowRight, Plus, FolderOpen } from 'lucide-react'
import type { TaskWithTags } from '../../../shared/types'

interface ProjectsViewProps {
  onNavigateToProject: (project: string) => void
}

const STATUS_DOT_COLOR: Record<string, string> = {
  'todo': 'bg-red-400',
  'in-progress': 'bg-amber-400',
  'done': 'bg-green-400',
  'archived': 'bg-gray-400',
}

interface ProjectStats {
  name: string
  taskCount: number
  statusBreakdown: { status: string; count: number }[]
}

function computeProjectStats(tasks: TaskWithTags[] | undefined, projects: string[]): ProjectStats[] {
  const map = new Map<string, Map<string, number>>()

  // Initialize all projects (including empty ones from localStorage)
  for (const p of projects) {
    map.set(p, new Map())
  }

  if (tasks) {
    for (const task of tasks) {
      for (const p of task.projects) {
        if (!map.has(p)) map.set(p, new Map())
        const statusMap = map.get(p)!
        statusMap.set(task.status, (statusMap.get(task.status) || 0) + 1)
      }
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, statusMap]) => {
      let taskCount = 0
      const statusBreakdown: { status: string; count: number }[] = []
      for (const [status, count] of statusMap) {
        taskCount += count
        statusBreakdown.push({ status, count })
      }
      statusBreakdown.sort((a, b) => a.status.localeCompare(b.status))
      return { name, taskCount, statusBreakdown }
    })
}

function normalizeProjectName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}

export function ProjectsView({ onNavigateToProject }: ProjectsViewProps) {
  const { data: tasks } = useTasks()
  const projects = useProjects()
  const bulkRename = useBulkRenameProject()
  const bulkRemove = useBulkRemoveProject()
  const createProject = useCreateProject()
  const removeCreatedProject = useRemoveCreatedProject()
  const renameCreatedProject = useRenameCreatedProject()
  const { toast } = useToast()

  const [renamingProject, setRenamingProject] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  const renameInputRef = useRef<HTMLInputElement>(null)
  const newProjectInputRef = useRef<HTMLInputElement>(null)

  const stats = useMemo(() => computeProjectStats(tasks, projects), [tasks, projects])

  useEffect(() => {
    if (renamingProject && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingProject])

  useEffect(() => {
    if (creatingNew && newProjectInputRef.current) {
      newProjectInputRef.current.focus()
    }
  }, [creatingNew])

  const handleStartRename = (projectName: string) => {
    setRenamingProject(projectName)
    setRenameValue(projectName)
    setConfirmingDelete(null)
  }

  const handleRename = async () => {
    if (!renamingProject) return
    const newName = normalizeProjectName(renameValue)
    if (!newName || newName === renamingProject) {
      setRenamingProject(null)
      return
    }
    if (projects.includes(newName)) {
      toast({ title: `Project "${newName}" already exists`, variant: 'error' })
      return
    }
    try {
      renameCreatedProject(renamingProject, newName)
      await bulkRename.mutateAsync({ oldName: renamingProject, newName })
      toast({ title: `Renamed to "${newName}"`, variant: 'success' })
    } catch {
      toast({ title: 'Failed to rename project', variant: 'error' })
    }
    setRenamingProject(null)
  }

  const handleDelete = async (projectName: string) => {
    if (confirmingDelete !== projectName) {
      setConfirmingDelete(projectName)
      return
    }
    try {
      removeCreatedProject(projectName)
      await bulkRemove.mutateAsync(projectName)
      toast({ title: `Deleted "${projectName}"`, variant: 'success' })
    } catch {
      toast({ title: 'Failed to delete project', variant: 'error' })
    }
    setConfirmingDelete(null)
  }

  const handleCreateNew = () => {
    const name = normalizeProjectName(newProjectName)
    if (!name) {
      setCreatingNew(false)
      setNewProjectName('')
      return
    }
    if (projects.includes(name)) {
      toast({ title: `Project "${name}" already exists`, variant: 'error' })
      return
    }
    createProject(name)
    toast({ title: `Created "${name}"`, variant: 'success' })
    setNewProjectName('')
    setCreatingNew(false)
  }

  if (stats.length === 0 && !creatingNew) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FolderOpen size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No projects yet</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
          Projects are created when you assign tasks to them, or you can create an empty project to get started.
        </p>
        <Button onClick={() => setCreatingNew(true)} className="gap-2">
          <Plus size={16} /> New Project
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Projects</h2>
        <Button size="sm" onClick={() => setCreatingNew(true)} className="gap-1.5">
          <Plus size={14} /> New Project
        </Button>
      </div>

      {creatingNew && (
        <div className="mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
          <input
            ref={newProjectInputRef}
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateNew()
              if (e.key === 'Escape') { setCreatingNew(false); setNewProjectName('') }
            }}
            placeholder="Project name..."
            className="w-full bg-transparent border-b border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 pb-1"
          />
          {newProjectName.trim() && (
            <p className="text-xs text-gray-400 mt-1">
              Will be created as: <span className="font-mono">{normalizeProjectName(newProjectName)}</span>
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {stats.map((project) => (
          <div
            key={project.name}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                {renamingProject === project.name ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename()
                      if (e.key === 'Escape') setRenamingProject(null)
                    }}
                    onBlur={() => setRenamingProject(null)}
                    className="w-full bg-transparent border-b border-primary-500 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none"
                  />
                ) : (
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {project.name}
                  </h3>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleStartRename(project.name)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
                  title="Rename"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(project.name)}
                  className={cn(
                    'p-1 rounded transition-colors text-sm',
                    confirmingDelete === project.name
                      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                      : 'text-gray-400 hover:text-red-500 dark:hover:text-red-400'
                  )}
                  title={confirmingDelete === project.name ? 'Click again to confirm' : 'Delete'}
                >
                  {confirmingDelete === project.name ? (
                    <span className="text-xs font-medium px-1">Confirm?</span>
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
                <button
                  onClick={() => onNavigateToProject(project.name)}
                  className="p-1 text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 rounded transition-colors"
                  title="View tasks"
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {project.taskCount} {project.taskCount === 1 ? 'task' : 'tasks'}
            </p>

            {project.statusBreakdown.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {project.statusBreakdown.map(({ status, count }) => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300"
                  >
                    <span className={cn('w-2 h-2 rounded-full', STATUS_DOT_COLOR[status] || 'bg-gray-400')} />
                    {count} {STATUS_LABELS[status] || status}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
