import { app, shell, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc-handlers'
import { setTokenChangedCallback, initAuth } from './auth'
import { setTasksChangedCallback } from './task-cache'
import { getChatConfig, setChatMode } from './chat-config'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type { ChatMode } from '../shared/types'

let bubbleWindow: BrowserWindow | null = null
let appWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createBubbleWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  bubbleWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    resizable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  bubbleWindow.setIgnoreMouseEvents(true, { forward: true })
  bubbleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  bubbleWindow.on('ready-to-show', () => {
    if (getChatConfig().chatMode === 'bubble') {
      bubbleWindow?.show()
    }
  })

  bubbleWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Never close the bubble — hide instead
  bubbleWindow.on('close', (event) => {
    if (bubbleWindow && !app.isQuitting) {
      event.preventDefault()
      bubbleWindow.hide()
    }
  })

  const resizeBubbleToDisplay = (): void => {
    if (!bubbleWindow || bubbleWindow.isDestroyed()) return
    const { width: w, height: h } = screen.getPrimaryDisplay().workAreaSize
    bubbleWindow.setBounds({ x: 0, y: 0, width: w, height: h })
  }

  screen.on('display-metrics-changed', resizeBubbleToDisplay)
  screen.on('display-added', resizeBubbleToDisplay)
  screen.on('display-removed', resizeBubbleToDisplay)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    bubbleWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    bubbleWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createAppWindow(): void {
  if (appWindow && !appWindow.isDestroyed()) {
    appWindow.focus()
    app.focus({ steal: true })
    return
  }

  appWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  appWindow.on('ready-to-show', () => {
    appWindow?.show()
    app.focus({ steal: true })
  })

  appWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    appWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?mode=app`)
  } else {
    appWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { mode: 'app' }
    })
  }

  appWindow.on('closed', () => {
    appWindow = null
  })
}

function createTray(): void {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png')).resize({ width: 22, height: 22 })
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Bubble',
      click: () => {
        if (getChatConfig().chatMode === 'docked') {
          createAppWindow()
        } else {
          bubbleWindow?.show()
        }
      }
    },
    {
      label: 'Open App',
      click: () => {
        createAppWindow()
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('My Tasks Plan')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (getChatConfig().chatMode === 'docked') {
      createAppWindow()
    } else {
      bubbleWindow?.show()
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.flowcore.my-tasks-plan')

  // Set up application menu so macOS shows the correct app name and menus
  const isMac = process.platform === 'darwin'
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    { role: 'fileMenu' as const },
    { role: 'editMenu' as const },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    { role: 'windowMenu' as const },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerAllHandlers()

  createBubbleWindow()
  createTray()

  // If chat mode is docked, auto-open the app window on startup
  if (getChatConfig().chatMode === 'docked') {
    createAppWindow()
  }

  // Open app window
  ipcMain.handle(IPC_CHANNELS.CHAT_OPEN_APP, () => {
    createAppWindow()
    return { success: true }
  })

  // Toggle mouse event pass-through on bubble overlay
  ipcMain.handle(IPC_CHANNELS.CHAT_SET_IGNORE_MOUSE, (_event, ignore: boolean) => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      if (ignore) {
        bubbleWindow.setIgnoreMouseEvents(true, { forward: true })
      } else {
        bubbleWindow.setIgnoreMouseEvents(false)
      }
    }
    return { success: true }
  })

  // Get persisted chat mode
  ipcMain.handle(IPC_CHANNELS.CHAT_GET_MODE, () => {
    return { success: true, data: getChatConfig().chatMode }
  })

  // Set chat mode — toggle bubble visibility and broadcast
  ipcMain.handle(IPC_CHANNELS.CHAT_SET_MODE, (_event, mode: ChatMode) => {
    setChatMode(mode)

    if (mode === 'docked') {
      if (bubbleWindow && !bubbleWindow.isDestroyed()) {
        bubbleWindow.hide()
      }
      createAppWindow()
    } else {
      if (bubbleWindow && !bubbleWindow.isDestroyed()) {
        bubbleWindow.show()
      }
    }

    // Broadcast to both windows
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.webContents.send(IPC_CHANNELS.CHAT_MODE_CHANGED, mode)
    }
    if (appWindow && !appWindow.isDestroyed()) {
      appWindow.webContents.send(IPC_CHANNELS.CHAT_MODE_CHANGED, mode)
    }

    return { success: true }
  })

  // Restore persisted auth session, then run migrations
  initAuth().then(async (restored) => {
    if (restored) {
      console.log('Auth session restored on startup')
      // Backfill source tag on existing tasks
      const { migrateSourceTag } = await import('./migrate-source-tag')
      await migrateSourceTag()
    } else {
      console.log('No auth session to restore')
    }
  })

  // Push token changes to all renderer windows
  setTokenChangedCallback((token) => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.webContents.send(IPC_CHANNELS.AUTH_STATUS_CHANGED, token)
    }
    if (appWindow && !appWindow.isDestroyed()) {
      appWindow.webContents.send(IPC_CHANNELS.AUTH_STATUS_CHANGED, token)
    }
  })

  // Push task data changes to all renderer windows so both the app and
  // overlay QueryClients stay in sync after mutations from either window.
  setTasksChangedCallback(() => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.webContents.send(IPC_CHANNELS.TASKS_CHANGED)
    }
    if (appWindow && !appWindow.isDestroyed()) {
      appWindow.webContents.send(IPC_CHANNELS.TASKS_CHANGED)
    }
  })

  app.on('activate', function () {
    if (!bubbleWindow || bubbleWindow.isDestroyed()) createBubbleWindow()
    else bubbleWindow.show()
  })
})

app.on('window-all-closed', () => {
  // No-op: keep app alive for the bubble overlay and tray icon
})

app.on('before-quit', () => {
  app.isQuitting = true
})

declare module 'electron' {
  interface App {
    isQuitting?: boolean
  }
}
