import { useQuery } from '@tanstack/react-query'
import type { WorkspaceMember } from '../../../shared/types'

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const res = await window.api.usable.listMembers()
      if (!res.success) throw new Error(res.error)
      return res.data as WorkspaceMember[]
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  })
}

export function resolveMemberName(members: WorkspaceMember[] | undefined, userId: string | undefined): string {
  if (!userId) return 'Unassigned'
  if (!members) return 'Loading...'
  const member = members.find(m => m.userId === userId)
  return member?.name || 'Unknown'
}
