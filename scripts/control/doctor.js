"use strict";

// `doctor`: is this machine set up so verification results can be trusted?
//
// Each check returns { name, status: "ok" | "warn" | "error", detail, fix }.
// Only errors fail the command; warnings are things that will bite later.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { findChrome } = require("./dev");

const ROOT = path.resolve(__dirname, "..", "..");

const ok = (name, detail) => ({ name, status: "ok", detail });
const warn = (name, detail, fix) => ({ name, status: "warn", detail, fix });
const error = (name, detail, fix) => ({ name, status: "error", detail, fix });

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function checkBunVersion(pkg, bunVersion = Bun.version) {
  const pinned = String(pkg.packageManager || "").match(/^bun@(.+)$/)?.[1];
  if (!pinned) return ok("bun", `Bun ${bunVersion} (no packageManager pin)`);
  if (pinned === bunVersion) return ok("bun", `Bun ${bunVersion} matches the pin`);
  return warn(
    "bun",
    `Bun ${bunVersion} but package.json pins ${pinned}. CI and the Docker image use ${pinned}.`,
    `Install Bun ${pinned} (bun upgrade --version ${pinned})`
  );
}

// A stale node_modules (a dependency one release behind package.json) made
// tests fail locally while CI passed. Compare installed versions to ranges.
function checkDependencies(pkg, { root = ROOT, satisfies = Bun.semver.satisfies } = {}) {
  const problems = [];
  const wanted = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [name, range] of Object.entries(wanted)) {
    if (!/^[~^<>=\d*x]/.test(range)) continue; // git, file, or tag specs
    const manifest = path.join(root, "node_modules", name, "package.json");
    if (!fs.existsSync(manifest)) {
      problems.push(`${name} is not installed`);
      continue;
    }
    const installed = readJson(manifest).version;
    if (!satisfies(installed, range)) problems.push(`${name} ${installed} does not satisfy ${range}`);
  }
  if (problems.length === 0) return ok("dependencies", "node_modules satisfies package.json");
  return error(
    "dependencies",
    `${problems.length} out of date: ${problems.slice(0, 5).join("; ")}${problems.length > 5 ? "; ..." : ""}`,
    "bun install --frozen-lockfile"
  );
}

function checkHooks(root = ROOT) {
  const result = spawnSync("git", ["config", "core.hooksPath"], { cwd: root, encoding: "utf8" });
  const value = (result.stdout || "").trim();
  if (value === ".githooks") return ok("git hooks", "pre-push lint hook is installed");
  return warn("git hooks", "pre-push lint hook is not installed", "bun run hooks:install");
}

function checkClientBuild(root = ROOT) {
  if (fs.existsSync(path.join(root, "embedded-client", "dist", "index.html"))) {
    return ok("embedded client", "embedded-client/dist is built");
  }
  return warn(
    "embedded client",
    "embedded-client/dist is missing, so `dev` and `browse` have nothing to serve",
    "bun run build:client"
  );
}

function checkBrowser() {
  const chrome = findChrome();
  if (chrome) return ok("browser", chrome);
  return warn("browser", "No Chrome or Edge found for `browse`", "Install Chrome or set CHROME_PATH");
}

function checkNode() {
  const result = spawnSync("node", ["--version"], { encoding: "utf8" });
  if (result.status !== 0) {
    return warn("node", "node is not on PATH (the ship-pr deploy check runs with node)", "Install Node 20+");
  }
  const major = Number(result.stdout.trim().replace(/^v/, "").split(".")[0]);
  if (major >= 20) return ok("node", result.stdout.trim());
  return warn("node", `${result.stdout.trim()} is older than 20`, "Install Node 20+");
}

// Bun loads .env from the working directory on its own. Say so when one exists,
// because it changes what tests and scripts see.
function checkEnvFile(root = ROOT) {
  if (!fs.existsSync(path.join(root, ".env"))) return ok(".env", "no local .env");
  return ok(
    ".env",
    "local .env present. Bun loads it automatically; `control` and the tracing tests run with --no-env-file"
  );
}

function runDoctor() {
  const pkg = readJson(path.join(ROOT, "package.json"));
  const checks = [
    checkBunVersion(pkg),
    checkDependencies(pkg),
    checkHooks(),
    checkClientBuild(),
    checkBrowser(),
    checkNode(),
    checkEnvFile(),
  ];
  return { ok: checks.every((c) => c.status !== "error"), checks };
}

function formatDoctor(report) {
  const marks = { ok: "ok   ", warn: "WARN ", error: "FAIL " };
  const lines = [];
  for (const check of report.checks) {
    lines.push(`${marks[check.status]} ${check.name}: ${check.detail}`);
    if (check.fix) lines.push(`       fix: ${check.fix}`);
  }
  return lines.join("\n");
}

module.exports = {
  checkBunVersion,
  checkDependencies,
  formatDoctor,
  runDoctor,
};
