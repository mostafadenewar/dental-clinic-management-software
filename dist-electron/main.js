import { app as t, ipcMain as f, BrowserWindow as _ } from "electron";
import { spawn as D } from "node:child_process";
import { existsSync as E } from "node:fs";
import { fileURLToPath as P } from "node:url";
import n from "node:path";
import T from "node:readline";
t.disableHardwareAcceleration();
const a = n.dirname(P(import.meta.url));
process.env.APP_ROOT = n.join(a, "..");
const m = process.env.VITE_DEV_SERVER_URL, y = n.join(process.env.APP_ROOT, "dist-electron"), h = n.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = m ? n.join(process.env.APP_ROOT, "public") : h;
let e, r = null, d = "";
const R = 1920, g = 1080, k = 1500, w = 1050;
function v() {
  const l = [
    n.join(a, "..", "backend"),
    n.join(process.resourcesPath ?? "", "backend")
  ];
  for (const c of l)
    if (c && E(n.join(c, "server.py"))) return c;
  return n.join(a, "..", "backend");
}
function O() {
  var u;
  const l = v(), c = process.env.DCMS_PYTHON ?? "python", I = t.isPackaged ? n.join(t.getPath("userData"), "data", "dental_clinic.db") : n.join(l, "data", "dental_clinic.db"), s = D(c, ["server.py", "--port", "0"], {
    cwd: l,
    windowsHide: !0,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      DCMS_DB: I,
      PYTHONUNBUFFERED: "1"
    }
  });
  r = s, T.createInterface({ input: s.stdout }).on("line", (o) => {
    const i = o.trim().match(/^DCMS_BACKEND_PORT=(\d+)$/);
    i && (d = `http://127.0.0.1:${i[1]}`, e == null || e.webContents.send("backend-url", d));
  }), (u = s.stderr) == null || u.on("data", (o) => {
    console.error(`[dcms] backend: ${o.toString().trimEnd()}`);
  }), s.on("error", (o) => {
    console.error("[dcms] failed to start Python backend:", o.message);
  }), s.on("exit", (o, i) => {
    r === s && (r = null, d = ""), o !== 0 && i !== "SIGTERM" && console.error(`[dcms] backend exited unexpectedly (code=${o ?? "null"}, signal=${i ?? "null"})`);
  });
}
function j() {
  r && !r.killed && (r.kill(), r = null);
}
function b() {
  e = new _({
    width: R,
    height: g,
    minWidth: k,
    minHeight: w,
    frame: !1,
    show: !1,
    backgroundColor: "#f8fafc",
    icon: n.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      backgroundThrottling: !1,
      nodeIntegration: !1,
      contextIsolation: !0,
      preload: n.join(a, "preload.mjs")
    }
  }), e.once("ready-to-show", () => {
    e == null || e.show();
  }), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString()), d && (e == null || e.webContents.send("backend-url", d));
  }), m ? e.loadURL(m) : e.loadFile(n.join(h, "index.html"));
}
f.on("window-minimize", () => {
  e == null || e.minimize();
});
f.on("window-toggle-maximize", () => {
  e != null && e.isMaximized() ? e.unmaximize() : e == null || e.maximize();
});
f.on("window-close", () => {
  e == null || e.close();
});
t.on("window-all-closed", () => {
  process.platform !== "darwin" && (t.quit(), e = null);
});
t.on("activate", () => {
  _.getAllWindows().length === 0 && b();
});
t.on("will-quit", () => {
  j();
});
t.whenReady().then(() => {
  O(), b();
});
export {
  y as MAIN_DIST,
  h as RENDERER_DIST,
  m as VITE_DEV_SERVER_URL
};
