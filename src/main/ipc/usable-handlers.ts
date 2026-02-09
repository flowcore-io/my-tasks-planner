import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { listWorkspaces, getFragmentTypes, checkConnection } from '../usable-api'
import { getWorkspaceConfig, setWorkspaceConfig, clearWorkspaceConfig } from '../workspace-config'
import type { IpcResponse, WorkspaceConfig } from '../../shared/types'

export function registerUsableHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.USABLE_LIST_WORKSPACES, async (): Promise<IpcResponse> => {
    try {
      const workspaces = await listWorkspaces()
      return { success: true, data: workspaces }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.USABLE_GET_FRAGMENT_TYPES, async (_event, workspaceId: string): Promise<IpcResponse> => {
    try {
      const types = await getFragmentTypes(workspaceId)
      return { success: true, data: types }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.USABLE_CONNECT_WORKSPACE, async (_event, workspaceId: string, workspaceName: string): Promise<IpcResponse> => {
    try {
      const types = await getFragmentTypes(workspaceId)
      const taskType = types.find(t => t.name.toLowerCase() === 'task')
        || types.find(t => t.name.toLowerCase() === 'knowledge')

      const config: WorkspaceConfig = {
        workspaceId,
        workspaceName,
        taskFragmentTypeId: taskType?.id,
      }
      setWorkspaceConfig(config)
      return { success: true, data: config }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.USABLE_GET_WORKSPACE, async (): Promise<IpcResponse> => {
    const config = getWorkspaceConfig()
    return { success: true, data: config }
  })

  ipcMain.handle(IPC_CHANNELS.USABLE_SET_WORKSPACE, async (_event, config: WorkspaceConfig | null): Promise<IpcResponse> => {
    if (config) {
      setWorkspaceConfig(config)
    } else {
      clearWorkspaceConfig()
    }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.USABLE_CHECK_CONNECTION, async (): Promise<IpcResponse<boolean>> => {
    try {
      const connected = await checkConnection()
      return { success: true, data: connected }
    } catch {
      return { success: true, data: false }
    }
  })
}
