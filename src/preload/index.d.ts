import type { IpcResponse, TaskWithTags, GraphData, ThemeMode, UsableWorkspace, UsableFragmentType, WorkspaceConfig } from '../shared/types'

interface TasksApi {
  list(filters?: { status?: string; priority?: string; tag?: string }): Promise<IpcResponse<TaskWithTags[]>>
  get(id: string): Promise<IpcResponse<TaskWithTags>>
  create(data: { title: string; description?: string; status?: string; priority?: string; tags?: string[] }): Promise<IpcResponse<TaskWithTags>>
  update(id: string, data: Record<string, unknown>): Promise<IpcResponse<TaskWithTags>>
  delete(id: string): Promise<IpcResponse<void>>
  reorder(updates: { id: string; kanbanOrder?: number; listOrder?: number; status?: string }[]): Promise<IpcResponse<void>>
  addComment(taskId: string, text: string): Promise<IpcResponse<TaskWithTags>>
}

interface DepsApi {
  list(taskId: string): Promise<IpcResponse<string[]>>
  add(taskId: string, dependsOnId: string): Promise<IpcResponse<{ taskId: string; dependsOnId: string }>>
  remove(taskId: string, dependsOnId: string): Promise<IpcResponse<void>>
  getGraph(): Promise<IpcResponse<GraphData>>
}

interface TagsApi {
  list(): Promise<IpcResponse<string[]>>
  create(data: { name: string }): Promise<IpcResponse<{ name: string }>>
  delete(tagName: string): Promise<IpcResponse<void>>
  assign(taskId: string, tagName: string): Promise<IpcResponse<void>>
  unassign(taskId: string, tagName: string): Promise<IpcResponse<void>>
}

interface AppApi {
  getTheme(): Promise<IpcResponse<ThemeMode>>
  setTheme(theme: string): Promise<IpcResponse<void>>
}

interface AuthApi {
  login(): Promise<IpcResponse<string>>
  logout(): Promise<IpcResponse<void>>
  getToken(): Promise<IpcResponse<string | null>>
  refreshToken(): Promise<IpcResponse<string | null>>
  isAuthenticated(): Promise<IpcResponse<boolean>>
  onTokenChanged(callback: (token: string | null) => void): () => void
}

interface UsableApi {
  listWorkspaces(): Promise<IpcResponse<UsableWorkspace[]>>
  getFragmentTypes(workspaceId: string): Promise<IpcResponse<UsableFragmentType[]>>
  connectWorkspace(workspaceId: string, workspaceName: string): Promise<IpcResponse<WorkspaceConfig>>
  getWorkspace(): Promise<IpcResponse<WorkspaceConfig | null>>
  setWorkspace(config: WorkspaceConfig | null): Promise<IpcResponse<void>>
  checkConnection(): Promise<IpcResponse<boolean>>
}

interface ChatApi {
  openApp(): Promise<IpcResponse<void>>
  setIgnoreMouseEvents(ignore: boolean): Promise<IpcResponse<void>>
}

interface Api {
  tasks: TasksApi
  deps: DepsApi
  tags: TagsApi
  app: AppApi
  chat: ChatApi
  auth: AuthApi
  usable: UsableApi
}

declare global {
  interface Window {
    api: Api
  }
}
