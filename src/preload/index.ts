import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'

const api = {
  tasks: {
    list: (filters?: { status?: string; priority?: string; tag?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.TASKS_LIST, filters),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_GET, id),
    create: (data: { title: string; description?: string; status?: string; priority?: string; tags?: string[]; projects?: string[] }) =>
      ipcRenderer.invoke(IPC_CHANNELS.TASKS_CREATE, data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC_CHANNELS.TASKS_UPDATE, id, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_DELETE, id),
    reorder: (updates: { id: string; kanbanOrder?: number; listOrder?: number; status?: string }[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.TASKS_REORDER, updates),
    addComment: (taskId: string, text: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TASKS_ADD_COMMENT, taskId, text),
  },
  deps: {
    list: (taskId: string) => ipcRenderer.invoke(IPC_CHANNELS.DEPS_LIST, taskId),
    add: (taskId: string, dependsOnId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DEPS_ADD, taskId, dependsOnId),
    remove: (taskId: string, dependsOnId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DEPS_REMOVE, taskId, dependsOnId),
    getGraph: () => ipcRenderer.invoke(IPC_CHANNELS.DEPS_GET_GRAPH),
  },
  tags: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.TAGS_LIST),
    create: (data: { name: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.TAGS_CREATE, data),
    delete: (tagName: string) => ipcRenderer.invoke(IPC_CHANNELS.TAGS_DELETE, tagName),
    assign: (taskId: string, tagName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TAGS_ASSIGN, taskId, tagName),
    unassign: (taskId: string, tagName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TAGS_UNASSIGN, taskId, tagName),
  },
  app: {
    getTheme: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_THEME),
    setTheme: (theme: string) => ipcRenderer.invoke(IPC_CHANNELS.APP_SET_THEME, theme),
  },
  usable: {
    listWorkspaces: () => ipcRenderer.invoke(IPC_CHANNELS.USABLE_LIST_WORKSPACES),
    getFragmentTypes: (workspaceId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.USABLE_GET_FRAGMENT_TYPES, workspaceId),
    connectWorkspace: (workspaceId: string, workspaceName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.USABLE_CONNECT_WORKSPACE, workspaceId, workspaceName),
    getWorkspace: () => ipcRenderer.invoke(IPC_CHANNELS.USABLE_GET_WORKSPACE),
    setWorkspace: (config: { workspaceId: string; workspaceName: string; taskFragmentTypeId?: string } | null) =>
      ipcRenderer.invoke(IPC_CHANNELS.USABLE_SET_WORKSPACE, config),
    checkConnection: () => ipcRenderer.invoke(IPC_CHANNELS.USABLE_CHECK_CONNECTION),
    listMembers: () => ipcRenderer.invoke(IPC_CHANNELS.USABLE_LIST_MEMBERS),
  },
  chat: {
    openApp: () => ipcRenderer.invoke(IPC_CHANNELS.CHAT_OPEN_APP),
    setIgnoreMouseEvents: (ignore: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.CHAT_SET_IGNORE_MOUSE, ignore),
    getMode: () => ipcRenderer.invoke(IPC_CHANNELS.CHAT_GET_MODE),
    setMode: (mode: string) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_SET_MODE, mode),
    injectThemeCss: (css: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CHAT_INJECT_THEME_CSS, css),
    onModeChanged: (callback: (mode: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, mode: string): void => {
        callback(mode)
      }
      ipcRenderer.on(IPC_CHANNELS.CHAT_MODE_CHANGED, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.CHAT_MODE_CHANGED, handler)
      }
    },
  },
  onTasksChanged: (callback: () => void) => {
    const handler = (): void => { callback() }
    ipcRenderer.on(IPC_CHANNELS.TASKS_CHANGED, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TASKS_CHANGED, handler)
    }
  },
  auth: {
    login: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
    getToken: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_TOKEN),
    refreshToken: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_ON_TOKEN_REFRESH),
    isAuthenticated: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_IS_AUTHENTICATED),
    onTokenChanged: (callback: (token: string | null) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, token: string | null): void => {
        callback(token)
      }
      ipcRenderer.on(IPC_CHANNELS.AUTH_STATUS_CHANGED, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.AUTH_STATUS_CHANGED, handler)
      }
    },
  },
}

contextBridge.exposeInMainWorld('api', api)
