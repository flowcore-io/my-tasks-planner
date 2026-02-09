import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { GraphData } from '../../../shared/types'

export function useGraph() {
  return useQuery({
    queryKey: ['graph'],
    queryFn: async () => {
      const res = await window.api.deps.getGraph()
      if (!res.success) throw new Error(res.error)
      return res.data as GraphData
    },
    staleTime: 30_000,
  })
}

export function useAddDependency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) => {
      const res = await window.api.deps.add(taskId, dependsOnId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graph'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useRemoveDependency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) => {
      const res = await window.api.deps.remove(taskId, dependsOnId)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graph'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useAddBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ thisTaskId, blockedTaskId }: { thisTaskId: string; blockedTaskId: string }) => {
      const res = await window.api.deps.add(blockedTaskId, thisTaskId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graph'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useRemoveBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ thisTaskId, blockedTaskId }: { thisTaskId: string; blockedTaskId: string }) => {
      const res = await window.api.deps.remove(blockedTaskId, thisTaskId)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graph'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
