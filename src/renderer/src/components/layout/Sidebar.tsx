import { cn } from '@/lib/utils'
import { ThemeToggle } from './ThemeToggle'
import { Button } from '@/components/ui/Button'
import { useConnectionStatus, useWorkspaceConfig } from '@/hooks/use-usable'
import { useState, useEffect, useCallback } from 'react'
import { List, Columns3, GitBranch, LogIn, LogOut, Settings } from 'lucide-react'
import type { ReactNode } from 'react'

interface SidebarProps {
  currentView: string
  onViewChange: (view: string) => void
  onOpenSettings?: () => void
}

const NAV_ITEMS: { id: string; label: string; icon: ReactNode }[] = [
  { id: 'list', label: 'List View', icon: <List size={16} /> },
  { id: 'kanban', label: 'Kanban Board', icon: <Columns3 size={16} /> },
  { id: 'graph', label: 'Dependency Graph', icon: <GitBranch size={16} /> },
]

export function Sidebar({ currentView, onViewChange, onOpenSettings }: SidebarProps) {
  const { data: isConnected } = useConnectionStatus()
  const { data: workspaceConfig } = useWorkspaceConfig()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)

  useEffect(() => {
    window.api.auth.isAuthenticated().then((result) => {
      if (result.success) setIsLoggedIn(result.data ?? false)
    })

    const cleanup = window.api.auth.onTokenChanged((token) => {
      setIsLoggedIn(token !== null)
    })
    return cleanup
  }, [])

  // Auto-trigger settings modal after login if no workspace configured
  useEffect(() => {
    if (isLoggedIn && !workspaceConfig?.workspaceId && onOpenSettings) {
      onOpenSettings()
    }
  }, [isLoggedIn, workspaceConfig?.workspaceId, onOpenSettings])

  const handleLogin = useCallback(async () => {
    setAuthLoading(true)
    try {
      const result = await window.api.auth.login()
      if (result.success) setIsLoggedIn(true)
    } catch {
      // user closed popup
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const handleLogout = useCallback(async () => {
    await window.api.auth.logout()
    setIsLoggedIn(false)
  }, [])

  // Connection indicator
  const connectionStatus = (() => {
    if (!isLoggedIn) return { color: 'bg-gray-400', label: 'Not logged in' }
    if (!workspaceConfig?.workspaceId) return { color: 'bg-gray-400', label: 'No workspace' }
    if (!workspaceConfig.taskFragmentTypeId) return { color: 'bg-yellow-500', label: workspaceConfig.workspaceName }
    if (isConnected) return { color: 'bg-green-500', label: workspaceConfig.workspaceName }
    return { color: 'bg-gray-400', label: workspaceConfig.workspaceName }
  })()

  return (
    <aside className="w-56 h-full bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">My Tasks</h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              currentView === item.id
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

      </nav>

      <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {/* Connection indicator */}
        <div className="flex items-center gap-2 px-1">
          <div className={cn('w-2 h-2 rounded-full shrink-0', connectionStatus.color)} />
          <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1">
            {connectionStatus.label}
          </span>
          {isLoggedIn && onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
            >
              <Settings size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isLoggedIn ? 'ghost' : 'primary'}
            onClick={isLoggedIn ? handleLogout : handleLogin}
            disabled={authLoading}
            className="text-xs gap-1 w-full"
          >
            {authLoading ? '...' : isLoggedIn ? <><LogOut size={14} /> Logout</> : <><LogIn size={14} /> Login</>}
          </Button>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  )
}
