import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTasks } from './use-tasks'
import { LOCALSTORAGE_KEYS } from '@/lib/utils'

function getCreatedProjects(): string[] {
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEYS.createdProjects)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function setCreatedProjects(projects: string[]) {
  try {
    if (projects.length > 0) {
      localStorage.setItem(LOCALSTORAGE_KEYS.createdProjects, JSON.stringify(projects))
    } else {
      localStorage.removeItem(LOCALSTORAGE_KEYS.createdProjects)
    }
  } catch { /* ignore */ }
}

/** Returns a sorted list of all unique project names (from tasks + localStorage). */
export function useProjects() {
  const { data: tasks } = useTasks()
  const [created, setCreated] = useState<string[]>(getCreatedProjects)

  // Sync state when localStorage changes externally
  useEffect(() => {
    const handler = () => setCreated(getCreatedProjects())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return useMemo(() => {
    const set = new Set<string>()
    if (tasks) {
      for (const task of tasks) {
        for (const p of task.projects) {
          set.add(p)
        }
      }
    }
    for (const p of created) {
      set.add(p)
    }
    return Array.from(set).sort()
  }, [tasks, created])
}

/** Create a project (persisted in localStorage until tasks back it). */
export function useCreateProject() {
  const [, setCreated] = useState<string[]>(getCreatedProjects)

  const createProject = useCallback((name: string) => {
    const current = getCreatedProjects()
    if (!current.includes(name)) {
      const next = [...current, name]
      setCreatedProjects(next)
      setCreated(next)
    }
  }, [])

  return createProject
}

/** Remove a project from the localStorage-backed list. */
export function useRemoveCreatedProject() {
  const [, setCreated] = useState<string[]>(getCreatedProjects)

  const removeCreatedProject = useCallback((name: string) => {
    const current = getCreatedProjects()
    const next = current.filter(p => p !== name)
    setCreatedProjects(next)
    setCreated(next)
  }, [])

  return removeCreatedProject
}

/** Rename a project in the localStorage-backed list. */
export function useRenameCreatedProject() {
  const [, setCreated] = useState<string[]>(getCreatedProjects)

  const renameCreatedProject = useCallback((oldName: string, newName: string) => {
    const current = getCreatedProjects()
    if (current.includes(oldName)) {
      const next = current.map(p => p === oldName ? newName : p)
      setCreatedProjects(next)
      setCreated(next)
    }
  }, [])

  return renameCreatedProject
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
