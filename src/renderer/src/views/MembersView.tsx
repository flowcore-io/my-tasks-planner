import { useMembers } from '@/hooks/use-members'
import { Users } from 'lucide-react'
import usableMascot from '@/assets/usable-mascot.png'

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  admin: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  member: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
}

export function MembersView() {
  const { data: members, isLoading, error } = useMembers()

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <img src={usableMascot} alt="" className="w-12 h-12 object-contain animate-pulse" />
        <span className="text-gray-500 dark:text-gray-400 text-sm">Loading members...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <img src={usableMascot} alt="" className="w-16 h-16 object-contain opacity-60" />
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-1">Failed to load members</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{String(error)}</p>
        </div>
      </div>
    )
  }

  if (!members || members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <img src={usableMascot} alt="" className="w-16 h-16 object-contain opacity-60" />
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-1">No members found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Members will appear here when your workspace has team members</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} className="text-gray-500 dark:text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Members</h2>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
          {members.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {members.map(member => (
          <div
            key={member.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-sm font-bold shrink-0">
                {member.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {member.name}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[member.role] || ROLE_COLORS.member}`}>
                    {member.role}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">
                  {member.email}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
