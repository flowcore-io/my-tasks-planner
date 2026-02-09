import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Dialog } from '@/components/ui/Dialog'
import { useCreateTask, useUpdateTask } from '@/hooks/use-tasks'
import { useTags } from '@/hooks/use-tags'
import { useProjects } from '@/hooks/use-projects'
import { X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { TaskWithTags } from '../../../../shared/types'

interface TaskFormProps {
  open: boolean
  onClose: () => void
  task?: TaskWithTags | null
}

export function TaskForm({ open, onClose, task }: TaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('todo')
  const [priority, setPriority] = useState('medium')
  const [taskTags, setTaskTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [taskProjects, setTaskProjects] = useState<string[]>([])
  const [projectInput, setProjectInput] = useState('')
  const [showProjectSuggestions, setShowProjectSuggestions] = useState(false)
  const [highlightedProjectIndex, setHighlightedProjectIndex] = useState(-1)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const { data: allTags } = useTags()
  const allProjects = useProjects()
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      setTitle(task?.title || '')
      setDescription(task?.description || '')
      setStatus(task?.status || 'todo')
      setPriority(task?.priority || 'medium')
      setTaskTags(task?.tags || [])
      setTaskProjects(task?.projects || [])
      setTagInput('')
      setProjectInput('')
      setShowSuggestions(false)
      setShowProjectSuggestions(false)
      setHighlightedIndex(-1)
      setHighlightedProjectIndex(-1)
    }
  }, [open, task])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    try {
      if (task) {
        await updateTask.mutateAsync({
          id: task.id,
          data: { title, description, status: status as any, priority: priority as any, tags: taskTags, projects: taskProjects },
        })
        toast({ title: 'Task updated', variant: 'success' })
      } else {
        await createTask.mutateAsync({
          title,
          description,
          status: status as any,
          priority: priority as any,
          tags: taskTags,
          projects: taskProjects,
        })
        toast({ title: 'Task created', variant: 'success' })
      }
      onClose()
    } catch {
      toast({ title: 'Failed to save task', variant: 'error' })
    }
  }

  const isEditing = !!task

  const addTag = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (!taskTags.includes(trimmed)) {
      setTaskTags(prev => [...prev, trimmed])
    }
    setTagInput('')
    setShowSuggestions(false)
    setHighlightedIndex(-1)
    tagInputRef.current?.focus()
  }

  const removeTag = (name: string) => {
    setTaskTags(prev => prev.filter(t => t !== name))
  }

  // Filter suggestions: match input, exclude already-assigned tags
  const suggestions = (allTags || [])
    .filter(tag => !taskTags.includes(tag) && tag.toLowerCase().includes(tagInput.toLowerCase()))

  const inputMatchesExisting = suggestions.some(s => s.toLowerCase() === tagInput.trim().toLowerCase())
  const showCreateOption = tagInput.trim() && !inputMatchesExisting && !taskTags.includes(tagInput.trim())

  // Project helpers
  const addProject = (name: string) => {
    const trimmed = name.trim().toLowerCase().replace(/\s+/g, '-')
    if (!trimmed) return
    if (!taskProjects.includes(trimmed)) {
      setTaskProjects(prev => [...prev, trimmed])
    }
    setProjectInput('')
    setShowProjectSuggestions(false)
    setHighlightedProjectIndex(-1)
    projectInputRef.current?.focus()
  }

  const removeProject = (name: string) => {
    setTaskProjects(prev => prev.filter(p => p !== name))
  }

  const projectSuggestions = (allProjects || [])
    .filter(p => !taskProjects.includes(p) && p.toLowerCase().includes(projectInput.toLowerCase()))

  const projectInputMatchesExisting = projectSuggestions.some(s => s.toLowerCase() === projectInput.trim().toLowerCase())
  const showCreateProjectOption = projectInput.trim() && !projectInputMatchesExisting && !taskProjects.includes(projectInput.trim().toLowerCase().replace(/\s+/g, '-'))
  const totalProjectOptions = projectSuggestions.length + (showCreateProjectOption ? 1 : 0)

  const handleProjectKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedProjectIndex >= 0 && highlightedProjectIndex < projectSuggestions.length) {
        addProject(projectSuggestions[highlightedProjectIndex])
      } else if (highlightedProjectIndex === projectSuggestions.length && showCreateProjectOption) {
        addProject(projectInput.trim())
      } else if (projectInput.trim()) {
        const exact = projectSuggestions.find(s => s.toLowerCase() === projectInput.trim().toLowerCase())
        addProject(exact || projectInput.trim())
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (totalProjectOptions > 0) {
        setShowProjectSuggestions(true)
        setHighlightedProjectIndex(prev => (prev + 1) % totalProjectOptions)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (totalProjectOptions > 0) {
        setShowProjectSuggestions(true)
        setHighlightedProjectIndex(prev => (prev - 1 + totalProjectOptions) % totalProjectOptions)
      }
    } else if (e.key === 'Escape') {
      setShowProjectSuggestions(false)
      setHighlightedProjectIndex(-1)
    } else if (e.key === 'Backspace' && !projectInput && taskProjects.length > 0) {
      removeProject(taskProjects[taskProjects.length - 1])
    }
  }

  const handleTagInputChange = (value: string) => {
    setTagInput(value)
    setShowSuggestions(true)
    setHighlightedIndex(-1)
  }

  const totalOptions = suggestions.length + (showCreateOption ? 1 : 0)

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        addTag(suggestions[highlightedIndex])
      } else if (highlightedIndex === suggestions.length && showCreateOption) {
        addTag(tagInput.trim())
      } else if (tagInput.trim()) {
        // If nothing highlighted, pick exact match or create new
        const exact = suggestions.find(s => s.toLowerCase() === tagInput.trim().toLowerCase())
        addTag(exact || tagInput.trim())
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (totalOptions > 0) {
        setShowSuggestions(true)
        setHighlightedIndex(prev => (prev + 1) % totalOptions)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (totalOptions > 0) {
        setShowSuggestions(true)
        setHighlightedIndex(prev => (prev - 1 + totalOptions) % totalOptions)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setHighlightedIndex(-1)
    } else if (e.key === 'Backspace' && !tagInput && taskTags.length > 0) {
      removeTag(taskTags[taskTags.length - 1])
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEditing ? 'Edit Task' : 'New Task'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input id="title" label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title..." required autoFocus />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the task..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 placeholder:text-gray-400 focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            id="status"
            label="Status"
            value={status}
            onChange={e => setStatus(e.target.value)}
            options={[
              { value: 'todo', label: 'To Do' },
              { value: 'in-progress', label: 'In Progress' },
              { value: 'done', label: 'Done' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          <Select
            id="priority"
            label="Priority"
            value={priority}
            onChange={e => setPriority(e.target.value)}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Tags</label>
          <div className="relative">
            <div
              className="flex flex-wrap gap-1.5 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 focus-within:border-primary-500 dark:focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20 transition-colors cursor-text"
              onClick={() => tagInputRef.current?.focus()}
            >
              {taskTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                    className="hover:text-primary-900 dark:hover:text-primary-200"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                value={tagInput}
                onChange={e => handleTagInputChange(e.target.value)}
                onFocus={() => { if (tagInput) setShowSuggestions(true) }}
                onBlur={() => { setTimeout(() => setShowSuggestions(false), 150) }}
                onKeyDown={handleTagKeyDown}
                placeholder={taskTags.length === 0 ? 'Add tags...' : ''}
                className="flex-1 min-w-[80px] bg-transparent text-sm text-gray-900 dark:text-gray-50 placeholder:text-gray-400 outline-none py-0.5"
              />
            </div>
            {showSuggestions && totalOptions > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-10 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg"
              >
                {suggestions.map((tag, i) => (
                  <button
                    key={tag}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => addTag(tag)}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      i === highlightedIndex
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {showCreateOption && (
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => addTag(tagInput.trim())}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      highlightedIndex === suggestions.length
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    Create "<span className="font-medium">{tagInput.trim()}</span>"
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Projects</label>
          <div className="relative">
            <div
              className="flex flex-wrap gap-1.5 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 focus-within:border-primary-500 dark:focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20 transition-colors cursor-text"
              onClick={() => projectInputRef.current?.focus()}
            >
              {taskProjects.map(project => (
                <span
                  key={project}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium"
                >
                  {project}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeProject(project) }}
                    className="hover:text-green-900 dark:hover:text-green-200"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                ref={projectInputRef}
                value={projectInput}
                onChange={e => { setProjectInput(e.target.value); setShowProjectSuggestions(true); setHighlightedProjectIndex(-1) }}
                onFocus={() => { if (projectInput) setShowProjectSuggestions(true) }}
                onBlur={() => { setTimeout(() => setShowProjectSuggestions(false), 150) }}
                onKeyDown={handleProjectKeyDown}
                placeholder={taskProjects.length === 0 ? 'Add projects...' : ''}
                className="flex-1 min-w-[80px] bg-transparent text-sm text-gray-900 dark:text-gray-50 placeholder:text-gray-400 outline-none py-0.5"
              />
            </div>
            {showProjectSuggestions && totalProjectOptions > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg">
                {projectSuggestions.map((project, i) => (
                  <button
                    key={project}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => addProject(project)}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      i === highlightedProjectIndex
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {project}
                  </button>
                ))}
                {showCreateProjectOption && (
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => addProject(projectInput.trim())}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      highlightedProjectIndex === projectSuggestions.length
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    Create "<span className="font-medium">{projectInput.trim().toLowerCase().replace(/\s+/g, '-')}</span>"
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!title.trim()} loading={createTask.isPending || updateTask.isPending}>
            {isEditing ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
