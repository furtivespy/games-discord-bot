#!/usr/bin/env bun
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const FIXTURES = [
  { name: "populated", query: "fixture=populated" },
  { name: "no-game", query: "fixture=no-game" },
  { name: "not-a-player", query: "fixture=not-a-player" },
  { name: "several-games", query: "fixture=several-games" },
  { name: "one-game", query: "fixture=one-game" },
  { name: "no-games", query: "fixture=no-games" },
  { name: "table", query: "fixture=several-games&game=newest-thread" },
];
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const OUT_DIR = path.resolve(
  process.argv[2] || path.join("tmp", "embedded-mock-screenshots")
);

function chromeBin() {
  const candidates = [
    process.env.CHROME_PATH,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);
  for (const bin of candidates) {
    const result = spawnSync("which", [bin], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  }
  return "";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // still booting
    }
    await wait(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function runChromeScreenshot(chrome, url, dest) {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--window-size=1280,800",
    "--virtual-time-budget=8000",
    `--screenshot=${dest}`,
    url,
  ];
  const result = spawnSync("timeout", ["20", chrome, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0 && result.status !== 124) {
    throw new Error(
      `Chrome screenshot failed for ${url}: ${result.stderr || result.stdout}`
    );
  }
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 100) {
    throw new Error(`Chrome did not write a screenshot to ${dest}`);
  }
}

async function main() {
  const chrome = chromeBin();
  if (!chrome) {
    console.error(
      "No Chrome/Chromium found. Install Chrome or set CHROME_PATH. Playwright example is in embedded-client/README.md."
    );
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let child = null;
  const startedServer = process.env.EMBEDDED_MOCK_URL
    ? null
    : spawn(process.execPath, [path.join(__dirname, "embedded-app-mock.js")], {
        env: { ...process.env, EMBEDDED_APP_MOCK: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
  child = startedServer;

  const base = process.env.EMBEDDED_MOCK_URL || `http://127.0.0.1:${DEFAULT_PORT}`;
  try {
    await waitForServer(base);
    for (const fixture of FIXTURES) {
      const dest = path.join(OUT_DIR, `mock-${fixture.name}.png`);
      runChromeScreenshot(chrome, `${base}/?${fixture.query}`, dest);
      console.log(`Wrote ${dest}`);
    }
  } finally {
    child?.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
