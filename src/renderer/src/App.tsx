import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { TaskForm } from '@/components/tasks/TaskForm'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { ListView } from '@/views/ListView'
import { KanbanView } from '@/views/KanbanView'
import { DependencyGraphView } from '@/views/DependencyGraphView'
import { GanttView } from '@/views/GanttView'
import { ProjectsView } from '@/views/ProjectsView'
import { MembersView } from '@/views/MembersView'
import { UsableEmbed } from '@/components/chat/UsableEmbed'
import { DockedChat } from '@/components/chat/DockedChat'
import { SettingsModal } from '@/components/usable/SettingsModal'
import { Button } from '@/components/ui/Button'
import { useChatPanel } from '@/hooks/use-chat-panel'
import { useApiReady } from '@/lib/ipc-client'
import { useProjects, useProjectFilter } from '@/hooks/use-projects'
import { useMembers } from '@/hooks/use-members'
import { useChatMode } from '@/hooks/use-chat-mode'
import { useTheme } from '@/hooks/use-theme'
import { useAppName } from '@/hooks/use-app-name'
import { LogIn } from 'lucide-react'
import type { TaskWithTags } from '../../shared/types'
import usableLogo from '@/assets/usable-logo-transparent.png'
import usableMascot from '@/assets/usable-mascot.png'

const isAppMode = new URLSearchParams(window.location.search).get('mode') === 'app'

type AuthState = 'checking' | 'authenticated' | 'unauthenticated' | 'logging-in'

export default function App() {
  const isReady = useApiReady()
  const qc = useQueryClient()

  // Apply dark/light theme class on <html> — must run in BOTH windows
  // (bubble overlay + app) so useChatEmbed can detect the correct theme.
  useTheme()
  const appName = useAppName()

  // Keep document title in sync with configured app name (e.g. when APP_NAME env is set)
  useEffect(() => {
    if (appName) document.title = appName
  }, [appName])

  // Listen for cross-window task mutation broadcasts from the main process.
  // When the other window (chat overlay or app) mutates tasks, this fires
  // so our QueryClient refetches fresh data.
  useEffect(() => {
    return window.api.onTasksChanged(() => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
    })
  }, [qc])
  const [currentView, setCurrentView] = useState('list')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskWithTags | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { chatState, bubbleCorner, setBubbleCorner, toggleChat, closeChat, openApp } = useChatPanel()
  const { chatMode, setMode: setChatMode } = useChatMode()
  const [dockedChatOpen, setDockedChatOpen] = useState(false)
  const projects = useProjects()
  const { selectedProjects, setSelectedProjects, toggleProject, clearProjects } = useProjectFilter()
  const { data: members } = useMembers()
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
  const toggleAssignee = useCallback((userId: string) => {
    setSelectedAssignees(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  }, [])
  const clearAssignees = useCallback(() => setSelectedAssignees([]), [])

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['task'] })
    qc.invalidateQueries({ queryKey: ['graph'] })
    qc.invalidateQueries({ queryKey: ['tags'] })
    qc.invalidateQueries({ queryKey: ['members'] })
  }, [qc])

  // Auto-open docked panel when switching to docked mode
  useEffect(() => {
    if (chatMode === 'docked') {
      setDockedChatOpen(true)
    } else {
      setDockedChatOpen(false)
    }
  }, [chatMode])

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
      <div className="h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 gap-4">
        <img src={usableMascot} alt="" className="w-16 h-16 object-contain animate-pulse" />
        <div className="text-gray-500 dark:text-gray-400 text-sm">Loading...</div>
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
      <div className="h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 gap-6">
        <div className="flex flex-col items-center gap-3">
          <img src={usableMascot} alt="" className="w-20 h-20 object-contain" />
          <div className="flex items-center gap-2">
            <img src={usableLogo} alt="" className="h-5 w-5 object-contain" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">{appName}</span>
          </div>
        </div>
        {authState === 'checking' || authState === 'logging-in' ? (
          <div className="text-center space-y-2">
            <div className="text-gray-500 dark:text-gray-400 text-sm">
              {authState === 'checking' ? 'Checking session...' : 'Logging in...'}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {authState === 'logging-in' && 'Complete login in the browser window'}
            </p>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">Login required to continue</p>
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

  const handleNavigateToProject = (projectName: string) => {
    setSelectedProjects([projectName])
    setCurrentView('list')
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
        chatMode={chatMode}
        dockedChatOpen={dockedChatOpen}
        onToggleDockedChat={() => setDockedChatOpen(prev => !prev)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onRefresh={handleRefresh}
          onNewTask={() => setShowTaskForm(true)}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          projects={projects}
          selectedProjects={selectedProjects}
          onToggleProject={toggleProject}
          onClearProjects={clearProjects}
          members={members}
          selectedAssignees={selectedAssignees}
          onToggleAssignee={toggleAssignee}
          onClearAssignees={clearAssignees}
        />

        <main className={`flex-1 ${currentView === 'gantt' ? 'overflow-hidden' : currentView === 'kanban' ? 'overflow-hidden p-4' : 'overflow-auto p-4'}`}>
          {currentView === 'list' && (
            <ListView filters={filters} onTaskClick={handleTaskClick} projectFilter={selectedProjects} assigneeFilter={selectedAssignees} />
          )}
          {currentView === 'kanban' && (
            <KanbanView onTaskClick={handleTaskClick} projectFilter={selectedProjects} assigneeFilter={selectedAssignees} />
          )}
          {currentView === 'gantt' && (
            <GanttView onTaskClick={handleTaskClick} projectFilter={selectedProjects} assigneeFilter={selectedAssignees} />
          )}
          {currentView === 'graph' && (
            <DependencyGraphView onTaskClick={handleTaskClick} projectFilter={selectedProjects} assigneeFilter={selectedAssignees} />
          )}
          {currentView === 'projects' && (
            <ProjectsView onNavigateToProject={handleNavigateToProject} />
          )}
          {currentView === 'members' && (
            <MembersView />
          )}
        </main>
      </div>

      {chatMode === 'docked' && (
        <DockedChat
          open={dockedChatOpen}
          onClose={() => setDockedChatOpen(false)}
        />
      )}

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
        chatMode={chatMode}
        onChatModeChange={setChatMode}
      />
    </div>
  )
}
