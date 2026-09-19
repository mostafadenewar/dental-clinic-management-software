import { app, ipcMain, BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline";
app.disableHardwareAcceleration();
const electronDirectory = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(electronDirectory, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let applicationWindow;
let backendProcess = null;
let backendUrl = "";
const DEFAULT_WINDOW_WIDTH = 1920;
const DEFAULT_WINDOW_HEIGHT = 1080;
const MIN_WINDOW_WIDTH = 1500;
const MIN_WINDOW_HEIGHT = 1050;
function backendPath() {
  const candidates = [
    path.join(electronDirectory, "..", "backend"),
    path.join(process.resourcesPath ?? "", "backend")
  ];
  for (const dir of candidates) {
    if (dir && existsSync(path.join(dir, "server.py"))) return dir;
  }
  return path.join(electronDirectory, "..", "backend");
}
function startBackend() {
  var _a;
  const dir = backendPath();
  const pythonCandidates = [
    process.env.DCMS_PYTHON,
    path.join(
      process.env.APP_ROOT,
      ".venv",
      process.platform === "win32" ? "Scripts\\python.exe" : "bin/python"
    ),
    process.platform === "win32" ? "python.exe" : "python3",
    "python"
  ].filter((candidate) => Boolean(candidate));
  const python = pythonCandidates.find((candidate) => candidate === "python" || candidate === "python.exe" || candidate === "python3" || existsSync(candidate)) ?? pythonCandidates[pythonCandidates.length - 1];
  const dbPath = app.isPackaged ? path.join(app.getPath("userData"), "data", "dental_clinic.db") : path.join(dir, "data", "dental_clinic.db");
  const child = spawn(python, ["server.py", "--port", "0"], {
    cwd: dir,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      DCMS_DB: dbPath,
      PYTHONUNBUFFERED: "1"
    }
  });
  backendProcess = child;
  const rl = readline.createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    const match = line.trim().match(/^DCMS_BACKEND_PORT=(\d+)$/);
    if (match) {
      backendUrl = `http://127.0.0.1:${match[1]}`;
      applicationWindow == null ? void 0 : applicationWindow.webContents.send("backend-url", backendUrl);
    }
  });
  (_a = child.stderr) == null ? void 0 : _a.on("data", (chunk) => {
    console.error(`[dcms] backend: ${chunk.toString().trimEnd()}`);
  });
  child.on("error", (err) => {
    console.error("[dcms] failed to start Python backend:", err.message);
  });
  child.on("exit", (code, signal) => {
    if (backendProcess === child) {
      backendProcess = null;
      backendUrl = "";
    }
    if (code !== 0 && signal !== "SIGTERM") {
      console.error(`[dcms] backend exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"})`);
    }
  });
}
function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
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
    backgroundColor: "#f8fafc",
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(electronDirectory, "preload.mjs")
    }
  });
  applicationWindow.once("ready-to-show", () => {
    applicationWindow == null ? void 0 : applicationWindow.show();
  });
  applicationWindow.webContents.on("did-finish-load", () => {
    applicationWindow == null ? void 0 : applicationWindow.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
    if (backendUrl) {
      applicationWindow == null ? void 0 : applicationWindow.webContents.send("backend-url", backendUrl);
    }
  });
  if (VITE_DEV_SERVER_URL) {
    applicationWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    applicationWindow.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
ipcMain.on("window-minimize", () => {
  applicationWindow == null ? void 0 : applicationWindow.minimize();
});
ipcMain.on("window-toggle-maximize", () => {
  if (applicationWindow == null ? void 0 : applicationWindow.isMaximized()) {
    applicationWindow.unmaximize();
  } else {
    applicationWindow == null ? void 0 : applicationWindow.maximize();
  }
});
ipcMain.on("window-close", () => {
  applicationWindow == null ? void 0 : applicationWindow.close();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    applicationWindow = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.on("will-quit", () => {
  stopBackend();
});
app.whenReady().then(() => {
  startBackend();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
