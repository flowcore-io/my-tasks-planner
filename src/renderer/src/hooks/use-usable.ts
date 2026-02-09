import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UsableWorkspace, UsableFragmentType, WorkspaceConfig } from '../../../shared/types'

export function useWorkspaces() {
  return useQuery<UsableWorkspace[]>({
    queryKey: ['usable', 'workspaces'],
    queryFn: async () => {
      const result = await window.api.usable.listWorkspaces()
      if (!result.success) throw new Error(result.error)
      return result.data ?? []
    },
    enabled: false, // Only fetch on demand
  })
}

export function useFragmentTypes(workspaceId: string | undefined) {
  return useQuery<UsableFragmentType[]>({
    queryKey: ['usable', 'fragment-types', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      const result = await window.api.usable.getFragmentTypes(workspaceId)
      if (!result.success) throw new Error(result.error)
      return result.data ?? []
    },
    enabled: !!workspaceId,
  })
}

export function useWorkspaceConfig() {
  return useQuery<WorkspaceConfig | null>({
    queryKey: ['usable', 'workspace-config'],
    queryFn: async () => {
      const result = await window.api.usable.getWorkspace()
      if (!result.success) throw new Error(result.error)
      return result.data ?? null
    },
  })
}

export function useConnectWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) => {
      const result = await window.api.usable.connectWorkspace(workspaceId, workspaceName)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usable', 'workspace-config'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export function useSetWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: WorkspaceConfig | null) => {
      const result = await window.api.usable.setWorkspace(config)
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usable', 'workspace-config'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export function useConnectionStatus() {
  return useQuery({
    queryKey: ['usable', 'connection'],
    queryFn: async () => {
      const result = await window.api.usable.checkConnection()
      if (!result.success) return false
      return result.data ?? false
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  })
}
