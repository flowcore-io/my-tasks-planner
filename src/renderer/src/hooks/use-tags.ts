import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await window.api.tags.list()
      if (!res.success) throw new Error(res.error)
      return res.data as string[]
    },
    staleTime: 30_000,
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await window.api.tags.create(data)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tagName: string) => {
      const res = await window.api.tags.delete(tagName)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useAssignTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, tagName }: { taskId: string; tagName: string }) => {
      const res = await window.api.tags.assign(taskId, tagName)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

export function useUnassignTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, tagName }: { taskId: string; tagName: string }) => {
      const res = await window.api.tags.unassign(taskId, tagName)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}
