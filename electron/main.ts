import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// NVIDIA's capture overlay can leave Chromium's accelerated surface in a
// degraded state after recording stops. Software compositing avoids that
// compositor handoff and keeps resizing and repainting consistent.
app.disableHardwareAcceleration()

const electronDirectory = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(electronDirectory, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let applicationWindow: BrowserWindow | null

const DEFAULT_WINDOW_WIDTH = 1920
const DEFAULT_WINDOW_HEIGHT = 1080
const MIN_WINDOW_WIDTH = 1500
const MIN_WINDOW_HEIGHT = 1050

function createWindow() {
  applicationWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    frame: false,
    show: false,
    backgroundColor: '#f8fafc',
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(electronDirectory, 'preload.mjs'),
    },
  })

  applicationWindow.once('ready-to-show', () => {
    applicationWindow?.show()
  })

  // Test active push message to Renderer-process.
  applicationWindow.webContents.on('did-finish-load', () => {
    applicationWindow?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    applicationWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // applicationWindow.loadFile('dist/index.html')
    applicationWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

ipcMain.on('window-minimize', () => {
  applicationWindow?.minimize()
})

ipcMain.on('window-toggle-maximize', () => {
  if (applicationWindow?.isMaximized()) {
    applicationWindow.unmaximize()
  } else {
    applicationWindow?.maximize()
  }
})

ipcMain.on('window-close', () => {
  applicationWindow?.close()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    applicationWindow = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
