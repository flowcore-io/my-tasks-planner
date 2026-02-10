import { StatusBadge } from './StatusBadge'
import { PriorityBadge } from './PriorityBadge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useDeleteTask, useUpdateTask, useAddComment, useTask } from '@/hooks/use-tasks'
import { useGraph, useAddDependency, useRemoveDependency, useAddBlock, useRemoveBlock } from '@/hooks/use-dependencies'
import { useTasks } from '@/hooks/use-tasks'
import { useWorkspaceConfig } from '@/hooks/use-usable'
import { useProjects } from '@/hooks/use-projects'
import { formatDate, formatShortDate, getScheduleHealth, STATUS_LABELS } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'
import { ExternalLink, Loader2, Search, X, FolderOpen, MessageSquare, Send, Calendar, AlertTriangle, Clock } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { TaskWithTags } from '../../../../shared/types'

interface TaskDetailProps {
  task: TaskWithTags | null
  open: boolean
  onClose: () => void
}

export function TaskDetail({ task: taskProp, open, onClose }: TaskDetailProps) {
  const { data: liveTask } = useTask(taskProp?.id ?? null)
  const task = liveTask ?? taskProp
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()
  const addComment = useAddComment()
  const [commentText, setCommentText] = useState('')
  const { data: graph } = useGraph()
  const { data: allTasks } = useTasks()
  const addDep = useAddDependency()
  const removeDep = useRemoveDependency()
  const addBlock = useAddBlock()
  const removeBlock = useRemoveBlock()
  const [addingDep, setAddingDep] = useState(false)
  const [depSearch, setDepSearch] = useState('')
  const [highlightedIdx, setHighlightedIdx] = useState(-1)
  const [removingDepId, setRemovingDepId] = useState<string | null>(null)
  const [addingBlock, setAddingBlock] = useState(false)
  const [blockSearch, setBlockSearch] = useState('')
  const [blockHighlightedIdx, setBlockHighlightedIdx] = useState(-1)
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null)
  const blockInputRef = useRef<HTMLInputElement>(null)
  const [editingProjects, setEditingProjects] = useState(false)
  const [projectInput, setProjectInput] = useState('')
  const depInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { data: config } = useWorkspaceConfig()
  const allProjects = useProjects()

  // Inline title editing
  const [title, setTitle] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (task) setTitle(task.title)
  }, [task])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Add a description...' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[80px] text-sm text-gray-600 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none',
      },
    },
    onBlur: ({ editor: ed }) => {
      if (!task) return
      const html = ed.getHTML()
      const isEmpty = html === '<p></p>' || html === ''
      const newDesc = isEmpty ? '' : html
      if (newDesc !== (task.description || '')) {
        updateTask.mutate(
          { id: task.id, data: { description: newDesc } },
          { onError: () => toast({ title: 'Failed to update description', variant: 'error' }) }
        )
      }
    },
  })

  // Sync editor content when task changes
  useEffect(() => {
    if (!editor || !task) return
    const current = editor.getHTML()
    const taskDesc = task.description || ''
    // Only reset if the content actually differs (avoid cursor jump)
    if (current !== taskDesc && !(current === '<p></p>' && taskDesc === '')) {
      editor.commands.setContent(taskDesc || '')
    }
  }, [task?.id, task?.description, editor])

  if (!task) return null

  const usableUrl = config?.workspaceId
    ? `https://usable.dev/dashboard/workspaces/${config.workspaceId}/fragments/${task.id}`
    : null

  const taskDeps = graph?.edges.filter(e => e.taskId === task.id) || []
  const depTasks = taskDeps.map(e => graph?.nodes.find(n => n.id === e.dependsOnId)).filter(Boolean)
  const availableForDep = (allTasks || []).filter(t => t.id !== task.id && !taskDeps.some(d => d.dependsOnId === t.id))

  const blockedEdges = graph?.edges.filter(e => e.dependsOnId === task.id) || []
  const blockedTasks = blockedEdges.map(e => graph?.nodes.find(n => n.id === e.taskId)).filter(Boolean)
  const availableForBlock = (allTasks || []).filter(t =>
    t.id !== task.id &&
    !blockedEdges.some(e => e.taskId === t.id) &&
    !taskDeps.some(d => d.dependsOnId === t.id)
  )

  const handleDelete = async () => {
    try {
      await deleteTask.mutateAsync(task.id)
      toast({ title: 'Task deleted', variant: 'success' })
      onClose()
    } catch {
      toast({ title: 'Failed to delete task', variant: 'error' })
    }
  }

  const handleTitleBlur = () => {
    const trimmed = title.trim()
    if (trimmed && trimmed !== task.title) {
      updateTask.mutate(
        { id: task.id, data: { title: trimmed } },
        { onError: () => { toast({ title: 'Failed to update title', variant: 'error' }); setTitle(task.title) } }
      )
    } else {
      setTitle(task.title)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      titleRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setTitle(task.title)
      titleRef.current?.blur()
    }
  }

  const handleStatusChange = (status: string) => {
    updateTask.mutate(
      { id: task.id, data: { status: status as any } },
      {
        onSuccess: () => toast({ title: 'Status updated', variant: 'success' }),
        onError: () => toast({ title: 'Failed to update status', variant: 'error' }),
      }
    )
  }

  const handlePriorityChange = (priority: string) => {
    updateTask.mutate(
      { id: task.id, data: { priority: priority as any } },
      {
        onSuccess: () => toast({ title: 'Priority updated', variant: 'success' }),
        onError: () => toast({ title: 'Failed to update priority', variant: 'error' }),
      }
    )
  }

  const handleAddDep = async (depId: string) => {
    try {
      await addDep.mutateAsync({ taskId: task.id, dependsOnId: depId })
      setDepSearch('')
      setHighlightedIdx(-1)
      setAddingDep(false)
      toast({ title: 'Dependency added', variant: 'success' })
    } catch {
      toast({ title: 'Failed to add dependency', variant: 'error' })
    }
  }

  // Filter and group available deps
  const query = depSearch.trim().toLowerCase()
  const filteredDeps = availableForDep.filter(t =>
    !query || t.title.toLowerCase().includes(query)
  )
  const groupedDeps = query
    ? filteredDeps.slice(0, 10) // flat list when searching
    : filteredDeps

  // For keyboard nav, build flat list of visible IDs
  const visibleIds = groupedDeps.map(t => t.id)

  const handleDepKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIdx(prev => Math.min(prev + 1, visibleIds.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIdx(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIdx >= 0 && highlightedIdx < visibleIds.length) {
        handleAddDep(visibleIds[highlightedIdx])
      }
    } else if (e.key === 'Escape') {
      setAddingDep(false)
      setDepSearch('')
      setHighlightedIdx(-1)
    }
  }

  const handleRemoveDep = async (depId: string) => {
    setRemovingDepId(depId)
    try {
      await removeDep.mutateAsync({ taskId: task.id, dependsOnId: depId })
      toast({ title: 'Dependency removed', variant: 'success' })
    } catch {
      toast({ title: 'Failed to remove dependency', variant: 'error' })
    } finally {
      setRemovingDepId(null)
    }
  }

  const handleAddBlock = async (blockedTaskId: string) => {
    try {
      await addBlock.mutateAsync({ thisTaskId: task.id, blockedTaskId })
      setBlockSearch('')
      setBlockHighlightedIdx(-1)
      setAddingBlock(false)
      toast({ title: 'Block added', variant: 'success' })
    } catch {
      toast({ title: 'Failed to add block', variant: 'error' })
    }
  }

  const handleRemoveBlock = async (blockedTaskId: string) => {
    setRemovingBlockId(blockedTaskId)
    try {
      await removeBlock.mutateAsync({ thisTaskId: task.id, blockedTaskId })
      toast({ title: 'Block removed', variant: 'success' })
    } catch {
      toast({ title: 'Failed to remove block', variant: 'error' })
    } finally {
      setRemovingBlockId(null)
    }
  }

  // Filter and group available blocks
  const blockQuery = blockSearch.trim().toLowerCase()
  const filteredBlocks = availableForBlock.filter(t =>
    !blockQuery || t.title.toLowerCase().includes(blockQuery)
  )
  const groupedBlocks = blockQuery
    ? filteredBlocks.slice(0, 10)
    : filteredBlocks

  const blockVisibleIds = groupedBlocks.map(t => t.id)

  const handleBlockKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setBlockHighlightedIdx(prev => Math.min(prev + 1, blockVisibleIds.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setBlockHighlightedIdx(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (blockHighlightedIdx >= 0 && blockHighlightedIdx < blockVisibleIds.length) {
        handleAddBlock(blockVisibleIds[blockHighlightedIdx])
      }
    } else if (e.key === 'Escape') {
      setAddingBlock(false)
      setBlockSearch('')
      setBlockHighlightedIdx(-1)
    }
  }

  const handleAddProject = (name: string) => {
    const trimmed = name.trim().toLowerCase().replace(/\s+/g, '-')
    if (!trimmed || task.projects.includes(trimmed)) return
    updateTask.mutate(
      { id: task.id, data: { projects: [...task.projects, trimmed] } },
      {
        onSuccess: () => toast({ title: 'Project added', variant: 'success' }),
        onError: () => toast({ title: 'Failed to add project', variant: 'error' }),
      }
    )
    setProjectInput('')
  }

  const handleRemoveProject = (name: string) => {
    updateTask.mutate(
      { id: task.id, data: { projects: task.projects.filter(p => p !== name) } },
      {
        onSuccess: () => toast({ title: 'Project removed', variant: 'success' }),
        onError: () => toast({ title: 'Failed to remove project', variant: 'error' }),
      }
    )
  }

  const projectSuggestions = (allProjects || [])
    .filter(p => !task.projects.includes(p) && p.toLowerCase().includes(projectInput.toLowerCase()))

  const titleNode = (
    <input
      ref={titleRef}
      value={title}
      onChange={e => setTitle(e.target.value)}
      onBlur={handleTitleBlur}
      onKeyDown={handleTitleKeyDown}
      className="text-lg font-semibold text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-primary-500 dark:focus:border-primary-400 outline-none w-full transition-colors"
    />
  )

  return (
    <Dialog open={open} onClose={onClose} title={titleNode} className="max-w-2xl">
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={task.status} onChange={handleStatusChange} />
          <PriorityBadge priority={task.priority} onChange={handlePriorityChange} />
          {task.projects.map(project => (
            <span key={project} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
              <FolderOpen size={10} />
              {project}
              <button
                onClick={() => handleRemoveProject(project)}
                className="hover:text-green-900 dark:hover:text-green-200"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {[...new Set(task.tags)].map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {tag}
            </span>
          ))}
          {!editingProjects ? (
            <button
              onClick={() => { setEditingProjects(true); setTimeout(() => projectInputRef.current?.focus(), 0) }}
              className="px-1.5 py-0.5 rounded text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              + project
            </button>
          ) : (
            <div className="relative">
              <input
                ref={projectInputRef}
                value={projectInput}
                onChange={e => setProjectInput(e.target.value)}
                onBlur={() => { setTimeout(() => setEditingProjects(false), 150) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (projectInput.trim()) handleAddProject(projectInput.trim())
                  }
                  if (e.key === 'Escape') {
                    setEditingProjects(false)
                    setProjectInput('')
                  }
                }}
                placeholder="Project name..."
                className="w-32 px-1.5 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 outline-none focus:border-primary-500"
              />
              {projectInput && projectSuggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 max-h-32 overflow-y-auto rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg">
                  {projectSuggestions.slice(0, 5).map(p => (
                    <button
                      key={p}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { handleAddProject(p); setEditingProjects(false) }}
                      className="w-full text-left px-2 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Schedule */}
        <ScheduleSection task={task} onUpdate={(data) => {
          updateTask.mutate(
            { id: task.id, data },
            { onError: () => toast({ title: 'Failed to update dates', variant: 'error' }) }
          )
        }} />

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus-within:border-primary-500 dark:focus-within:border-primary-400 transition-colors">
          <EditorContent editor={editor} />
        </div>

        {/* Comments */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={14} className="text-gray-500 dark:text-gray-400" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Comments</h3>
            {task.comments.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                {task.comments.length}
              </span>
            )}
          </div>
          {task.comments.length > 0 && (
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {[...task.comments].reverse().map(comment => (
                <div key={comment.id} className="flex gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {(comment.author || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 dark:text-gray-200 text-xs">{comment.author}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-xs whitespace-pre-wrap break-words">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && commentText.trim()) {
                  e.preventDefault()
                  addComment.mutate(
                    { taskId: task.id, text: commentText.trim() },
                    {
                      onSuccess: () => setCommentText(''),
                      onError: () => toast({ title: 'Failed to add comment', variant: 'error' }),
                    }
                  )
                }
              }}
              placeholder="Add a comment..."
              rows={1}
              className="flex-1 text-sm px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 placeholder:text-gray-400 outline-none focus:border-primary-500 dark:focus:border-primary-400 resize-none"
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={!commentText.trim() || addComment.isPending}
              onClick={() => {
                if (!commentText.trim()) return
                addComment.mutate(
                  { taskId: task.id, text: commentText.trim() },
                  {
                    onSuccess: () => setCommentText(''),
                    onError: () => toast({ title: 'Failed to add comment', variant: 'error' }),
                  }
                )
              }}
            >
              {addComment.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </Button>
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Created {formatDate(task.createdAt)} | Updated {formatDate(task.updatedAt)}
        </div>

        {/* Dependencies */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Dependencies</h3>
          <div className="space-y-3">
            {/* Depends on */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Depends on</span>
                <Button size="sm" variant="ghost" onClick={() => { setAddingDep(!addingDep); setDepSearch(''); setHighlightedIdx(-1) }}>
                  {addingDep ? 'Cancel' : '+ Add'}
                </Button>
              </div>
              {depTasks.length > 0 ? (
                <div className="space-y-1">
                  {taskDeps.map(dep => {
                    const depTask = graph?.nodes.find(n => n.id === dep.dependsOnId)
                    if (!depTask) return null
                    return (
                      <div key={dep.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-1.5 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusBadge status={depTask.status} />
                          <span className="text-gray-700 dark:text-gray-300 truncate">{depTask.title}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveDep(dep.dependsOnId)}
                          disabled={removingDepId === dep.dependsOnId}
                          className="text-gray-400 hover:text-danger-500 text-xs disabled:opacity-50 flex items-center gap-1 shrink-0 ml-2"
                        >
                          {removingDepId === dep.dependsOnId && <Loader2 size={10} className="animate-spin" />}
                          Remove
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">No dependencies</p>
              )}
              {addingDep && (
                <DepPicker
                  inputRef={depInputRef}
                  search={depSearch}
                  onSearchChange={v => { setDepSearch(v); setHighlightedIdx(-1) }}
                  onKeyDown={handleDepKeyDown}
                  tasks={groupedDeps}
                  highlightedIdx={highlightedIdx}
                  isSearching={!!query}
                  onSelect={handleAddDep}
                  isPending={addDep.isPending}
                  pendingId={addDep.variables?.dependsOnId ?? null}
                />
              )}
            </div>

            {/* Blocks */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Blocks</span>
                <Button size="sm" variant="ghost" onClick={() => { setAddingBlock(!addingBlock); setBlockSearch(''); setBlockHighlightedIdx(-1) }}>
                  {addingBlock ? 'Cancel' : '+ Add'}
                </Button>
              </div>
              {blockedTasks.length > 0 ? (
                <div className="space-y-1">
                  {blockedEdges.map(edge => {
                    const blockedTask = graph?.nodes.find(n => n.id === edge.taskId)
                    if (!blockedTask) return null
                    return (
                      <div key={edge.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-1.5 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusBadge status={blockedTask.status} />
                          <span className="text-gray-700 dark:text-gray-300 truncate">{blockedTask.title}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveBlock(edge.taskId)}
                          disabled={removingBlockId === edge.taskId}
                          className="text-gray-400 hover:text-danger-500 text-xs disabled:opacity-50 flex items-center gap-1 shrink-0 ml-2"
                        >
                          {removingBlockId === edge.taskId && <Loader2 size={10} className="animate-spin" />}
                          Remove
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">Not blocking any tasks</p>
              )}
              {addingBlock && (
                <DepPicker
                  inputRef={blockInputRef}
                  search={blockSearch}
                  onSearchChange={v => { setBlockSearch(v); setBlockHighlightedIdx(-1) }}
                  onKeyDown={handleBlockKeyDown}
                  tasks={groupedBlocks}
                  highlightedIdx={blockHighlightedIdx}
                  isSearching={!!blockQuery}
                  onSelect={handleAddBlock}
                  isPending={addBlock.isPending}
                  pendingId={addBlock.variables?.blockedTaskId ?? null}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleteTask.isPending}>Delete</Button>
            {usableUrl && (
              <a
                href={usableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <ExternalLink size={12} />
                Open in Usable
              </a>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  )
}

/* ── Schedule section ── */

const HEALTH_STYLES: Record<string, { color: string; icon: typeof AlertTriangle | null; label: string }> = {
  'overdue': { color: 'text-red-500', icon: AlertTriangle, label: 'Overdue' },
  'at-risk': { color: 'text-amber-500', icon: Clock, label: 'At risk' },
  'on-track': { color: 'text-green-500', icon: null, label: 'On track' },
  'done': { color: 'text-green-500', icon: null, label: 'Done' },
  'no-deadline': { color: 'text-gray-400', icon: null, label: '' },
}

function ScheduleSection({ task, onUpdate }: { task: TaskWithTags; onUpdate: (data: { startDate?: string | null; endDate?: string | null }) => void }) {
  const [editingStart, setEditingStart] = useState(false)
  const [editingEnd, setEditingEnd] = useState(false)
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)

  const health = getScheduleHealth(task)
  const healthStyle = HEALTH_STYLES[health]

  useEffect(() => {
    if (editingStart) startRef.current?.focus()
  }, [editingStart])
  useEffect(() => {
    if (editingEnd) endRef.current?.focus()
  }, [editingEnd])

  const handleStartBlur = (value: string) => {
    setEditingStart(false)
    const newVal = value || null
    if (newVal !== (task.startDate ?? null)) {
      onUpdate({ startDate: newVal })
    }
  }

  const handleEndBlur = (value: string) => {
    setEditingEnd(false)
    const newVal = value || null
    if (newVal !== (task.endDate ?? null)) {
      onUpdate({ endDate: newVal })
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Calendar size={14} className="text-gray-400 shrink-0" />
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 dark:text-gray-400">Start:</span>
        {editingStart ? (
          <input
            ref={startRef}
            type="date"
            defaultValue={task.startDate || ''}
            onBlur={e => handleStartBlur(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
            className="text-xs px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 outline-none focus:border-primary-500"
          />
        ) : (
          <button
            onClick={() => setEditingStart(true)}
            className="text-xs px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
          >
            {task.startDate ? formatShortDate(task.startDate) : 'None'}
          </button>
        )}
      </div>
      <span className="text-gray-300 dark:text-gray-600">-</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 dark:text-gray-400">End:</span>
        {editingEnd ? (
          <input
            ref={endRef}
            type="date"
            defaultValue={task.endDate || ''}
            onBlur={e => handleEndBlur(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
            className="text-xs px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 outline-none focus:border-primary-500"
          />
        ) : (
          <button
            onClick={() => setEditingEnd(true)}
            className="text-xs px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
          >
            {task.endDate ? formatShortDate(task.endDate) : 'None'}
          </button>
        )}
      </div>
      {health !== 'no-deadline' && health !== 'done' && healthStyle.icon && (
        <span className={`flex items-center gap-1 text-xs ${healthStyle.color}`}>
          <healthStyle.icon size={12} />
          {healthStyle.label}
        </span>
      )}
    </div>
  )
}

/* ── Dependency search picker ── */

const STATUS_ORDER: string[] = ['in-progress', 'todo', 'done', 'archived']

function DepPicker({
  inputRef,
  search,
  onSearchChange,
  onKeyDown,
  tasks,
  highlightedIdx,
  isSearching,
  onSelect,
  isPending,
  pendingId,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  search: string
  onSearchChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  tasks: TaskWithTags[]
  highlightedIdx: number
  isSearching: boolean
  onSelect: (id: string) => void
  isPending: boolean
  pendingId: string | null
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [inputRef])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIdx < 0 || !listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${highlightedIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIdx])

  // Group by status when not searching
  const grouped = isSearching
    ? null
    : STATUS_ORDER
        .map(status => ({ status, items: tasks.filter(t => t.status === status) }))
        .filter(g => g.items.length > 0)

  let flatIdx = 0

  return (
    <div className="mt-2 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search tasks..."
          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-50 placeholder:text-gray-400 outline-none"
        />
      </div>
      <div ref={listRef} className="max-h-48 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500 text-center">No matching tasks</p>
        ) : grouped ? (
          grouped.map(group => {
            const header = (
              <div key={`h-${group.status}`} className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/30 sticky top-0">
                {STATUS_LABELS[group.status] || group.status}
              </div>
            )
            const rows = group.items.map(t => {
              const idx = flatIdx++
              return (
                <DepRow
                  key={t.id}
                  task={t}
                  idx={idx}
                  highlighted={idx === highlightedIdx}
                  onSelect={onSelect}
                  isPending={isPending && pendingId === t.id}
                  disabled={isPending}
                />
              )
            })
            return [header, ...rows]
          })
        ) : (
          tasks.map(t => {
            const idx = flatIdx++
            return (
              <DepRow
                key={t.id}
                task={t}
                idx={idx}
                highlighted={idx === highlightedIdx}
                onSelect={onSelect}
                isPending={isPending && pendingId === t.id}
                disabled={isPending}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

function DepRow({
  task,
  idx,
  highlighted,
  onSelect,
  isPending,
  disabled,
}: {
  task: TaskWithTags
  idx: number
  highlighted: boolean
  onSelect: (id: string) => void
  isPending: boolean
  disabled: boolean
}) {
  return (
    <button
      data-idx={idx}
      onClick={() => onSelect(task.id)}
      disabled={disabled}
      className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors disabled:opacity-50 ${
        highlighted
          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      {isPending && <Loader2 size={12} className="animate-spin shrink-0" />}
      <StatusBadge status={task.status} />
      <span className="truncate">{task.title}</span>
    </button>
  )
}
