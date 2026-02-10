import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Plus, ChevronDown, X, FolderOpen, Users } from 'lucide-react'
import type { WorkspaceMember } from '../../../../shared/types'

interface HeaderProps {
  onNewTask: () => void
  statusFilter: string
  onStatusFilterChange: (v: string) => void
  priorityFilter: string
  onPriorityFilterChange: (v: string) => void
  projects: string[]
  selectedProjects: string[]
  onToggleProject: (project: string) => void
  onClearProjects: () => void
  members?: WorkspaceMember[]
  selectedAssignees: string[]
  onToggleAssignee: (userId: string) => void
  onClearAssignees: () => void
}

export function Header({
  onNewTask,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  projects,
  selectedProjects,
  onToggleProject,
  onClearProjects,
  members,
  selectedAssignees,
  onToggleAssignee,
  onClearAssignees,
}: HeaderProps) {
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const assigneeDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false)
      }
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
        setAssigneeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="h-14 px-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className="w-36">
          <Select
            value={statusFilter}
            onChange={e => onStatusFilterChange(e.target.value)}
            options={[
              { value: '', label: 'All Status' },
              { value: 'todo', label: 'To Do' },
              { value: 'in-progress', label: 'In Progress' },
              { value: 'done', label: 'Done' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>
        <div className="w-36">
          <Select
            value={priorityFilter}
            onChange={e => onPriorityFilterChange(e.target.value)}
            options={[
              { value: '', label: 'All Priority' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />
        </div>

        {/* Project filter dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <FolderOpen size={14} className="text-gray-400" />
            {selectedProjects.length === 0 ? (
              <span>All Projects</span>
            ) : (
              <span>{selectedProjects.length} project{selectedProjects.length !== 1 ? 's' : ''}</span>
            )}
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {selectedProjects.length > 0 && (
            <button
              onClick={onClearProjects}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-400 dark:bg-gray-500 text-white flex items-center justify-center hover:bg-gray-500 dark:hover:bg-gray-400"
            >
              <X size={10} />
            </button>
          )}

          {projectDropdownOpen && (
            <div className="absolute z-20 left-0 mt-1 w-56 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg py-1">
              {projects.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No projects yet. Assign projects to tasks to see them here.</p>
              ) : (
                <>
                  {projects.map(project => (
                    <label
                      key={project}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(project)}
                        onChange={() => onToggleProject(project)}
                        className="rounded border-gray-300 dark:border-gray-500 text-primary-600 focus:ring-primary-500"
                      />
                      {project}
                    </label>
                  ))}
                  {selectedProjects.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-600 mt-1 pt-1">
                      <button
                        onClick={onClearProjects}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        Clear filter
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Selected project chips */}
        {selectedProjects.length > 0 && (
          <div className="flex items-center gap-1 ml-1">
            {selectedProjects.map(p => (
              <span
                key={p}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-medium"
              >
                {p}
                <button onClick={() => onToggleProject(p)} className="hover:text-primary-900 dark:hover:text-primary-200">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Assignee filter dropdown */}
        <div ref={assigneeDropdownRef} className="relative">
          <button
            onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <Users size={14} className="text-gray-400" />
            {selectedAssignees.length === 0 ? (
              <span>All Assignees</span>
            ) : (
              <span>{selectedAssignees.length} assignee{selectedAssignees.length !== 1 ? 's' : ''}</span>
            )}
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {selectedAssignees.length > 0 && (
            <button
              onClick={onClearAssignees}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-400 dark:bg-gray-500 text-white flex items-center justify-center hover:bg-gray-500 dark:hover:bg-gray-400"
            >
              <X size={10} />
            </button>
          )}

          {assigneeDropdownOpen && (
            <div className="absolute z-20 left-0 mt-1 w-56 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg py-1">
              {!members || members.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No members found.</p>
              ) : (
                <>
                  {members.map(member => (
                    <label
                      key={member.userId}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAssignees.includes(member.userId)}
                        onChange={() => onToggleAssignee(member.userId)}
                        className="rounded border-gray-300 dark:border-gray-500 text-primary-600 focus:ring-primary-500"
                      />
                      {member.name}
                    </label>
                  ))}
                  {selectedAssignees.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-600 mt-1 pt-1">
                      <button
                        onClick={onClearAssignees}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        Clear filter
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Selected assignee chips */}
        {selectedAssignees.length > 0 && members && (
          <div className="flex items-center gap-1 ml-1">
            {selectedAssignees.map(uid => {
              const m = members.find(x => x.userId === uid)
              return (
                <span
                  key={uid}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium"
                >
                  {m?.name || uid}
                  <button onClick={() => onToggleAssignee(uid)} className="hover:text-blue-900 dark:hover:text-blue-200">
                    <X size={10} />
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>
      <Button onClick={onNewTask} className="gap-1.5">
        <Plus size={16} /> New Task
      </Button>
    </header>
  )
}
