export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'archived'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ThemeMode = 'light' | 'dark' | 'system'
export type ChatMode = 'bubble' | 'docked'

export interface TaskComment {
  id: string
  text: string
  author: string
  authorEmail: string
  createdAt: string
}

export interface TaskWithTags {
  id: string           // fragment ID
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  kanbanOrder: number
  listOrder: number
  createdAt: string    // ISO from frontmatter
  updatedAt: string    // ISO from fragment
  tags: string[]       // plain strings (user tags only, no status:/priority: prefixes)
  projects: string[]   // project names (extracted from project: tags)
  dependencies: string[] // fragment IDs
  comments: TaskComment[]
}

export interface CreateTaskInput {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  tags?: string[]
  projects?: string[]
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  kanbanOrder?: number
  listOrder?: number
  tags?: string[]
  projects?: string[]
  dependencies?: string[]
  comments?: TaskComment[]
}

export interface GraphData {
  nodes: TaskWithTags[]
  edges: { id: string; taskId: string; dependsOnId: string }[]
}

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface UsableWorkspace {
  id: string
  name: string
  description?: string
}

export interface UsableFragmentType {
  id: string
  name: string
  description?: string
}

export interface WorkspaceConfig {
  workspaceId: string
  workspaceName: string
  taskFragmentTypeId?: string
}
