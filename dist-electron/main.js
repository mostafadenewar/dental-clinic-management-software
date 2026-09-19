import { app, ipcMain, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
app.disableHardwareAcceleration();
const electronDirectory = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(electronDirectory, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let applicationWindow;
const DEFAULT_WINDOW_WIDTH = 1920;
const DEFAULT_WINDOW_HEIGHT = 1080;
const MIN_WINDOW_WIDTH = 1500;
const MIN_WINDOW_HEIGHT = 1050;
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
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
