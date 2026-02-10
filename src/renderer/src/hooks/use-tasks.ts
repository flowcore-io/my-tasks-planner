import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TaskWithTags, CreateTaskInput, UpdateTaskInput } from '../../../shared/types'

export function useTasks(filters?: { status?: string; priority?: string; tag?: string }) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const res = await window.api.tasks.list(filters)
      if (!res.success) throw new Error(res.error)
      return res.data as TaskWithTags[]
    },
    staleTime: 300_000,
    refetchOnWindowFocus: true,
  })
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: async () => {
      if (!id) return null
      const res = await window.api.tasks.get(id)
      if (!res.success) throw new Error(res.error)
      return res.data as TaskWithTags
    },
    enabled: !!id,
    staleTime: 300_000,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateTaskInput) => {
      const res = await window.api.tasks.create(data)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTaskInput }) => {
      const res = await window.api.tasks.update(id, data as unknown as Record<string, unknown>)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await window.api.tasks.delete(id)
      if (!res.success) throw new Error(res.error)
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] })
      qc.setQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] }, (old) =>
        old ? old.filter(t => t.id !== id) : old
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export function useBulkDeleteTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map(id => window.api.tasks.delete(id))
      )
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length) throw new Error(`Failed to delete ${failed.length} tasks`)
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] })
      const idSet = new Set(ids)
      qc.setQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] }, (old) =>
        old ? old.filter(t => !idSet.has(t.id)) : old
      )
      return { previous }
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

export function useBulkUpdateStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const results = await Promise.allSettled(
        ids.map(id => window.api.tasks.update(id, { status }))
      )
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length) throw new Error(`Failed to update ${failed.length} tasks`)
    },
    onMutate: async ({ ids, status }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] })
      const idSet = new Set(ids)
      qc.setQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] }, (old) =>
        old ? old.map(t => idSet.has(t.id) ? { ...t, status: status as TaskWithTags['status'] } : t) : old
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export function useBulkAddToProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, project }: { ids: string[]; project: string }) => {
      // For each task, fetch current projects and add the new one
      const results = await Promise.allSettled(
        ids.map(async id => {
          const getRes = await window.api.tasks.get(id)
          if (!getRes.success) throw new Error(getRes.error)
          const task = getRes.data as TaskWithTags
          const currentProjects = task.projects || []
          if (currentProjects.includes(project)) return // Already has this project
          const newProjects = [...currentProjects, project]
          return window.api.tasks.update(id, { projects: newProjects })
        })
      )
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length) throw new Error(`Failed to update ${failed.length} tasks`)
    },
    onMutate: async ({ ids, project }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] })
      const idSet = new Set(ids)
      qc.setQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] }, (old) =>
        old ? old.map(t => idSet.has(t.id) && !t.projects.includes(project)
          ? { ...t, projects: [...t.projects, project] }
          : t
        ) : old
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export function useBulkRenameProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const tasksRes = await window.api.tasks.list()
      if (!tasksRes.success) throw new Error(tasksRes.error)
      const allTasks = tasksRes.data as TaskWithTags[]
      const affected = allTasks.filter(t => t.projects.includes(oldName))
      const results = await Promise.allSettled(
        affected.map(t => {
          const newProjects = t.projects.map(p => p === oldName ? newName : p)
          return window.api.tasks.update(t.id, { projects: newProjects })
        })
      )
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length) throw new Error(`Failed to rename project on ${failed.length} tasks`)
    },
    onMutate: async ({ oldName, newName }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] })
      qc.setQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] }, (old) =>
        old ? old.map(t => t.projects.includes(oldName)
          ? { ...t, projects: t.projects.map(p => p === oldName ? newName : p) }
          : t
        ) : old
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export function useBulkRemoveProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (projectName: string) => {
      const tasksRes = await window.api.tasks.list()
      if (!tasksRes.success) throw new Error(tasksRes.error)
      const allTasks = tasksRes.data as TaskWithTags[]
      const affected = allTasks.filter(t => t.projects.includes(projectName))
      const results = await Promise.allSettled(
        affected.map(t => {
          const newProjects = t.projects.filter(p => p !== projectName)
          return window.api.tasks.update(t.id, { projects: newProjects })
        })
      )
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length) throw new Error(`Failed to remove project from ${failed.length} tasks`)
    },
    onMutate: async (projectName) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] })
      qc.setQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] }, (old) =>
        old ? old.map(t => t.projects.includes(projectName)
          ? { ...t, projects: t.projects.filter(p => p !== projectName) }
          : t
        ) : old
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, text }: { taskId: string; text: string }) => {
      const res = await window.api.tasks.addComment(taskId, text)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task'] })
    },
  })
}

export function useReorderTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (updates: { id: string; kanbanOrder?: number; listOrder?: number; status?: string }[]) => {
      const res = await window.api.tasks.reorder(updates)
      if (!res.success) throw new Error(res.error)
    },
    onMutate: async (updates) => {
      // Cancel in-flight refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ['tasks'] })

      // Snapshot current cache for rollback
      const previous = qc.getQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] })

      // Optimistically patch all matching task caches
      qc.setQueriesData<TaskWithTags[]>({ queryKey: ['tasks'] }, (old) => {
        if (!old) return old
        return old.map(task => {
          const update = updates.find(u => u.id === task.id)
          if (!update) return task
          return {
            ...task,
            ...(update.kanbanOrder !== undefined ? { kanbanOrder: update.kanbanOrder } : {}),
            ...(update.listOrder !== undefined ? { listOrder: update.listOrder } : {}),
            ...(update.status !== undefined ? { status: update.status as TaskWithTags['status'] } : {}),
          }
        })
      })

      return { previous }
    },
    onError: (_err, _updates, context) => {
      // Rollback on failure
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      // Mark stale without triggering an immediate refetch to avoid a flash
      qc.invalidateQueries({ queryKey: ['tasks'], refetchType: 'none' })
      qc.invalidateQueries({ queryKey: ['graph'], refetchType: 'none' })
    },
  })
}
