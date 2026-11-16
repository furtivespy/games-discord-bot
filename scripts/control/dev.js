"use strict";

// `dev` and `browse`: run the embedded Activity in mock mode and look at it.
//
// `dev` starts scripts/embedded-app-mock.js in the background (or reuses a
// server that is already answering /health) and records its pid so
// `dev --stop` can clean up. `browse` screenshots a page with headless Chrome
// or Edge. Output lands in tmp/control-gamebot/.

const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "tmp", "control-gamebot");
const PID_FILE = path.join(OUT_DIR, "dev.pid");
const LOG_FILE = path.join(OUT_DIR, "dev.log");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function originFor(port) {
  return `http://127.0.0.1:${port}`;
}

async function probe(origin) {
  try {
    const res = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.status === "ok" ? body : null;
  } catch {
    return null;
  }
}

function readPid() {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

async function startDev({ port = Number(process.env.PORT || 3000), timeoutMs = 20_000 } = {}) {
  const origin = originFor(port);
  const existing = await probe(origin);
  if (existing) return { ok: true, origin, started: false, pid: readPid(), sha: existing.sha };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const logFd = fs.openSync(LOG_FILE, "w");
  // --no-env-file: the mock must not pick up real credentials from a local .env.
  const child = spawn(
    process.execPath,
    ["--no-env-file", path.join(ROOT, "scripts", "embedded-app-mock.js")],
    {
      cwd: ROOT,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: { ...process.env, EMBEDDED_APP_MOCK: "1", PORT: String(port), NODE_ENV: "development" },
    }
  );
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid));

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const body = await probe(origin);
    if (body) return { ok: true, origin, started: true, pid: child.pid, sha: body.sha };
    await sleep(250);
  }
  stopDev();
  return {
    ok: false,
    origin,
    started: false,
    error: `Mock server did not answer ${origin}/health within ${timeoutMs}ms. See ${path.relative(ROOT, LOG_FILE)}.`,
  };
}

function stopDev() {
  const pid = readPid();
  if (!pid) return { ok: true, stopped: false };
  try {
    process.kill(pid);
  } catch {
    // already gone
  }
  fs.rmSync(PID_FILE, { force: true });
  return { ok: true, stopped: true, pid };
}

function findChrome(env = process.env, exists = fs.existsSync) {
  const candidates = [
    env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((candidate) => exists(candidate)) || null;
}

// Screenshot of `pathAndQuery` (for example "/?fixture=populated") on the dev server.
async function browse({
  pathAndQuery = "/?fixture=several-games&game=newest-thread",
  out,
  port,
  width = 1280,
  height = 800,
} = {}) {
  const chrome = findChrome();
  if (!chrome) {
    return { ok: false, error: "No Chrome or Edge found. Install one or set CHROME_PATH." };
  }
  if (!fs.existsSync(path.join(ROOT, "embedded-client", "dist", "index.html"))) {
    return { ok: false, error: "embedded-client is not built. Run `bun run build:client` first." };
  }
  const dev = await startDev({ port });
  if (!dev.ok) return dev;

  const slug = pathAndQuery.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") || "root";
  const dest = path.resolve(out || path.join(OUT_DIR, `${slug}.png`));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.rmSync(dest, { force: true });

  const url = `${dev.origin}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  const result = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--window-size=${width},${height}`,
      "--virtual-time-budget=8000",
      `--screenshot=${dest}`,
      url,
    ],
    { encoding: "utf8", timeout: 30_000 }
  );
  // Leave a server the user started themselves alone; clean up one we started.
  if (dev.started) stopDev();
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 100) {
    return {
      ok: false,
      error: `Browser did not write a screenshot. ${result.stderr || result.stdout || ""}`.trim(),
    };
  }
  return { ok: true, url, screenshot: path.relative(ROOT, dest) };
}

module.exports = { OUT_DIR, browse, findChrome, originFor, probe, startDev, stopDev };
