import { app as n, ipcMain as s, BrowserWindow as t } from "electron";
import { fileURLToPath as l } from "node:url";
import o from "node:path";
n.disableHardwareAcceleration();
const r = o.dirname(l(import.meta.url));
process.env.APP_ROOT = o.join(r, "..");
const i = process.env.VITE_DEV_SERVER_URL, R = o.join(process.env.APP_ROOT, "dist-electron"), a = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = i ? o.join(process.env.APP_ROOT, "public") : a;
let e;
const d = 1920, m = 1080, p = 1500, _ = 1050;
function c() {
  e = new t({
    width: d,
    height: m,
    minWidth: p,
    minHeight: _,
    frame: !1,
    show: !1,
    backgroundColor: "#f8fafc",
    icon: o.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      backgroundThrottling: !1,
      nodeIntegration: !1,
      contextIsolation: !0,
      preload: o.join(r, "preload.mjs")
    }
  }), e.once("ready-to-show", () => {
    e == null || e.show();
  }), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), i ? e.loadURL(i) : e.loadFile(o.join(a, "index.html"));
}
s.on("window-minimize", () => {
  e == null || e.minimize();
});
s.on("window-toggle-maximize", () => {
  e != null && e.isMaximized() ? e.unmaximize() : e == null || e.maximize();
});
s.on("window-close", () => {
  e == null || e.close();
});
n.on("window-all-closed", () => {
  process.platform !== "darwin" && (n.quit(), e = null);
});
n.on("activate", () => {
  t.getAllWindows().length === 0 && c();
});
n.whenReady().then(c);
export {
  R as MAIN_DIST,
  a as RENDERER_DIST,
  i as VITE_DEV_SERVER_URL
};
