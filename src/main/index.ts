import { app, shell, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc-handlers'
import { setTokenChangedCallback, initAuth } from './auth'
import { IPC_CHANNELS } from '../shared/ipc-channels'

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
    bubbleWindow?.show()
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
    return
  }

  appWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  appWindow.on('ready-to-show', () => {
    appWindow?.show()
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
        bubbleWindow?.show()
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
    bubbleWindow?.show()
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.flowcore.my-tasks-plan')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerAllHandlers()

  createBubbleWindow()
  createTray()

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

  // Restore persisted auth session
  initAuth().then((restored) => {
    if (restored) console.log('Auth session restored on startup')
    else console.log('No auth session to restore')
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
