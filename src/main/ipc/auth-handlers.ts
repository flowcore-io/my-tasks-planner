import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { login, logout, getToken, refreshAccessToken, isAuthenticated } from '../auth'

export function registerAuthHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async () => {
    try {
      const token = await login()
      return { success: true, data: token }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Login failed' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    try {
      logout()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Logout failed' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_TOKEN, async () => {
    try {
      const token = getToken()
      return { success: true, data: token }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get token' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_ON_TOKEN_REFRESH, async () => {
    try {
      const token = await refreshAccessToken()
      return { success: true, data: token }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Token refresh failed' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_IS_AUTHENTICATED, async () => {
    try {
      return { success: true, data: isAuthenticated() }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Check failed' }
    }
  })

  console.log('Auth IPC handlers registered')
}
