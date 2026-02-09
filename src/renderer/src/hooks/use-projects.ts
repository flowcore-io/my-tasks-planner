import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTasks } from './use-tasks'
import { LOCALSTORAGE_KEYS } from '@/lib/utils'

/** Returns a sorted list of all unique project names across tasks. */
export function useProjects() {
  const { data: tasks } = useTasks()

  return useMemo(() => {
    if (!tasks) return []
    const set = new Set<string>()
    for (const task of tasks) {
      for (const p of task.projects) {
        set.add(p)
      }
    }
    return Array.from(set).sort()
  }, [tasks])
}

/** Persisted multi-select project filter backed by localStorage. */
export function useProjectFilter() {
  const [selectedProjects, setSelectedProjectsState] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(LOCALSTORAGE_KEYS.projectFilter)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      if (selectedProjects.length > 0) {
        localStorage.setItem(LOCALSTORAGE_KEYS.projectFilter, JSON.stringify(selectedProjects))
      } else {
        localStorage.removeItem(LOCALSTORAGE_KEYS.projectFilter)
      }
    } catch { /* ignore */ }
  }, [selectedProjects])

  const setSelectedProjects = useCallback((projects: string[]) => {
    setSelectedProjectsState(projects)
  }, [])

  const toggleProject = useCallback((project: string) => {
    setSelectedProjectsState(prev =>
      prev.includes(project) ? prev.filter(p => p !== project) : [...prev, project]
    )
  }, [])

  const clearProjects = useCallback(() => {
    setSelectedProjectsState([])
  }, [])

  return { selectedProjects, setSelectedProjects, toggleProject, clearProjects }
}
