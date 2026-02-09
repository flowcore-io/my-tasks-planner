import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { TaskForm } from '@/components/tasks/TaskForm'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { ListView } from '@/views/ListView'
import { KanbanView } from '@/views/KanbanView'
import { DependencyGraphView } from '@/views/DependencyGraphView'
import { UsableEmbed } from '@/components/chat/UsableEmbed'
import { SettingsModal } from '@/components/usable/SettingsModal'
import { Button } from '@/components/ui/Button'
import { useChatPanel } from '@/hooks/use-chat-panel'
import { useApiReady } from '@/lib/ipc-client'
import { useProjects, useProjectFilter } from '@/hooks/use-projects'
import { LogIn } from 'lucide-react'
import type { TaskWithTags } from '../../shared/types'

const isAppMode = new URLSearchParams(window.location.search).get('mode') === 'app'

type AuthState = 'checking' | 'authenticated' | 'unauthenticated' | 'logging-in'

export default function App() {
  const isReady = useApiReady()
  const [currentView, setCurrentView] = useState('list')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskWithTags | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { chatState, bubbleCorner, setBubbleCorner, toggleChat, closeChat, openApp } = useChatPanel()
  const projects = useProjects()
  const { selectedProjects, toggleProject, clearProjects } = useProjectFilter()

  // Auth gate for app mode
  const [authState, setAuthState] = useState<AuthState>('checking')

  const triggerLogin = useCallback(async () => {
    setAuthState('logging-in')
    try {
      const result = await window.api.auth.login()
      if (result.success) {
        setAuthState('authenticated')
      } else {
        setAuthState('unauthenticated')
      }
    } catch {
      // User closed the login window
      setAuthState('unauthenticated')
    }
  }, [])

  useEffect(() => {
    if (!isReady || !isAppMode) return

    window.api.auth.isAuthenticated().then(result => {
      if (result.success && result.data) {
        setAuthState('authenticated')
      } else {
        // Not authenticated — auto-trigger login
        triggerLogin()
      }
    })

    const cleanup = window.api.auth.onTokenChanged(token => {
      setAuthState(token ? 'authenticated' : 'unauthenticated')
    })
    return cleanup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady])

  if (!isReady) {
    if (!isAppMode) return null // Transparent overlay — show nothing while loading
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  // Default mode: transparent bubble overlay
  if (!isAppMode) {
    return (
      <UsableEmbed
        chatState={chatState}
        bubbleCorner={bubbleCorner}
        onToggle={toggleChat}
        onClose={closeChat}
        onOpenApp={openApp}
        onBubbleCornerChange={setBubbleCorner}
      />
    )
  }

  // App mode: auth gate
  if (authState !== 'authenticated') {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        {authState === 'checking' || authState === 'logging-in' ? (
          <div className="text-center space-y-2">
            <div className="text-gray-500 dark:text-gray-400">
              {authState === 'checking' ? 'Checking session...' : 'Logging in...'}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {authState === 'logging-in' && 'Complete login in the browser window'}
            </p>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-gray-600 dark:text-gray-300">Login required to continue</p>
            <Button onClick={triggerLogin} className="gap-2">
              <LogIn size={16} /> Login
            </Button>
          </div>
        )}
      </div>
    )
  }

  // App mode: full task management UI
  const handleTaskClick = (task: TaskWithTags) => {
    setSelectedTask(task)
    setShowDetail(true)
  }

  const filters = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(priorityFilter ? { priority: priorityFilter } : {}),
  }

  return (
    <div className="h-screen flex overflow-hidden bg-white dark:bg-gray-900">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onNewTask={() => setShowTaskForm(true)}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          projects={projects}
          selectedProjects={selectedProjects}
          onToggleProject={toggleProject}
          onClearProjects={clearProjects}
        />

        <main className={`flex-1 p-4 ${currentView === 'kanban' ? 'overflow-hidden' : 'overflow-auto'}`}>
          {currentView === 'list' && (
            <ListView filters={filters} onTaskClick={handleTaskClick} projectFilter={selectedProjects} />
          )}
          {currentView === 'kanban' && (
            <KanbanView onTaskClick={handleTaskClick} projectFilter={selectedProjects} />
          )}
          {currentView === 'graph' && (
            <DependencyGraphView onTaskClick={handleTaskClick} projectFilter={selectedProjects} />
          )}
        </main>
      </div>

      <TaskForm
        open={showTaskForm}
        onClose={() => setShowTaskForm(false)}
      />

      <TaskDetail
        task={selectedTask}
        open={showDetail}
        onClose={() => setShowDetail(false)}
      />

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  )
}
