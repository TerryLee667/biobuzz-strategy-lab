const { app, BrowserWindow } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// The static site produced by `next build` (output: "export").
const root = path.join(__dirname, "..", "out");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".ts": "text/javascript; charset=utf-8", // Turbopack emits the Web Worker as a .ts asset
};

/** Map a request path to a file inside out/, honouring trailingSlash (dir/index.html). */
function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const rel = clean.endsWith("/") ? clean + "index.html" : clean;
  for (const candidate of [rel, path.join(rel, "index.html")]) {
    const abs = path.join(root, candidate);
    if (!abs.startsWith(root)) continue; // path traversal guard
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  return null;
}

function startServer() {
  const server = http.createServer((req, res) => {
    const file = resolveFile(req.url || "/");
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    // Port 0 lets the OS pick a free port; the page is served over http so the Web Workers work.
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function createWindow() {
  const { server, port } = await startServer();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: "#0b0b0c",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(`http://127.0.0.1:${port}/`);
  win.on("closed", () => server.close());
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
