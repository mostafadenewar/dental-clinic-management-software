import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import readline from 'node:readline'

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
let backendProcess: ChildProcess | null = null
let backendUrl = ''

const DEFAULT_WINDOW_WIDTH = 1920
const DEFAULT_WINDOW_HEIGHT = 1080
const MIN_WINDOW_WIDTH = 1500
const MIN_WINDOW_HEIGHT = 1050

// The Python backend lives next to the main process source. In a packaged app
// electron-builder must place `backend/` under resources (see electron-builder.json5).
function backendPath(): string {
  const candidates = [
    path.join(electronDirectory, '..', 'backend'),
    path.join(process.resourcesPath ?? '', 'backend'),
  ]
  for (const dir of candidates) {
    if (dir && existsSync(path.join(dir, 'server.py'))) return dir
  }
  return path.join(electronDirectory, '..', 'backend')
}

function startBackend() {
  const dir = backendPath()
  const pythonCandidates = [
    process.env.DCMS_PYTHON,
    path.join(
      process.env.APP_ROOT,
      '.venv',
      process.platform === 'win32' ? 'Scripts\\python.exe' : 'bin/python',
    ),
    process.platform === 'win32' ? 'python.exe' : 'python3',
    'python',
  ].filter((candidate): candidate is string => Boolean(candidate))
  const python = pythonCandidates.find((candidate) => (
    candidate === 'python' ||
    candidate === 'python.exe' ||
    candidate === 'python3' ||
    existsSync(candidate)
  )) ?? pythonCandidates[pythonCandidates.length - 1]
  const dbPath = app.isPackaged
    ? path.join(app.getPath('userData'), 'data', 'dental_clinic.db')
    : path.join(dir, 'data', 'dental_clinic.db')
  const child = spawn(python, ['server.py', '--port', '0'], {
    cwd: dir,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DCMS_DB: dbPath,
      PYTHONUNBUFFERED: '1',
    },
  })
  backendProcess = child

  const rl = readline.createInterface({ input: child.stdout })
  rl.on('line', (line) => {
    const match = line.trim().match(/^DCMS_BACKEND_PORT=(\d+)$/)
    if (match) {
      backendUrl = `http://127.0.0.1:${match[1]}`
      applicationWindow?.webContents.send('backend-url', backendUrl)
    }
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    console.error(`[dcms] backend: ${chunk.toString().trimEnd()}`)
  })
  child.on('error', (err) => {
    console.error('[dcms] failed to start Python backend:', err.message)
  })
  child.on('exit', (code, signal) => {
    if (backendProcess === child) {
      backendProcess = null
      backendUrl = ''
    }
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error(`[dcms] backend exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'})`)
    }
  })
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill()
    backendProcess = null
  }
}

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
    if (backendUrl) {
      applicationWindow?.webContents.send('backend-url', backendUrl)
    }
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

app.on('will-quit', () => {
  stopBackend()
})

app.whenReady().then(() => {
  startBackend()
  createWindow()
})
