#!/usr/bin/env node
"use strict";

// Waits until the running bot reports the expected commit at GET /health.
//
// The host pulls the `latest` image about every 5 minutes, so a merge is only
// "shipped" once /health serves the new SHA. A newer deployed commit that
// contains the expected one also counts (two merges can land back to back).
//
// Usage: node scripts/check-deployed-version.js
//   SHIP_PR_SHA / EXPECTED_SHA  commit that must be running (required)
//   HEALTH_URL                  default https://gamebot.willsullivan.dev/health
//   TIMEOUT_MINUTES             default 20
//   INTERVAL_SECONDS            default 30

const { execFileSync } = require("node:child_process");

const DEFAULT_HEALTH_URL = "https://gamebot.willsullivan.dev/health";

function git(args) {
  execFileSync("git", args, { stdio: "ignore" });
}

// True when `expected` is an ancestor of `deployed` in this clone.
function deployedContains(deployed, expected) {
  try {
    try {
      git(["cat-file", "-e", `${deployed}^{commit}`]);
    } catch {
      git(["fetch", "--quiet", "origin", "master"]);
      git(["cat-file", "-e", `${deployed}^{commit}`]);
    }
    git(["merge-base", "--is-ancestor", expected, deployed]);
    return true;
  } catch {
    return false;
  }
}

// "match" | "newer" | "wait"
function decide({ deployed, expected, contains = deployedContains }) {
  if (!deployed || deployed === "unknown") return "wait";
  if (deployed === expected) return "match";
  return contains(deployed, expected) ? "newer" : "wait";
}

// The sha reported by /health, or null when unreachable, not JSON (an older
// build answers /health with the SPA's index.html), or without a sha.
async function readDeployedSha(url, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.sha === "string" ? body.sha : null;
  } catch {
    return null;
  }
}

async function waitForDeploy({
  expected,
  url = DEFAULT_HEALTH_URL,
  timeoutMs = 20 * 60_000,
  intervalMs = 30_000,
  fetchImpl = fetch,
  contains = deployedContains,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console.log,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const deployed = await readDeployedSha(url, fetchImpl);
    const outcome = decide({ deployed, expected, contains });
    if (outcome === "match") {
      log(`Deployed ${deployed} matches this merge.`);
      return true;
    }
    if (outcome === "newer") {
      log(`Deployed ${deployed} is newer and contains ${expected}.`);
      return true;
    }
    log(`deployed=${deployed ?? "none"} expected=${expected}; retrying`);
    await sleep(intervalMs);
  }
  return false;
}

async function main(env = process.env) {
  const expected = env.SHIP_PR_SHA || env.EXPECTED_SHA;
  if (!expected) {
    console.error("Set SHIP_PR_SHA (or EXPECTED_SHA) to the commit that must be running.");
    return 2;
  }
  const url = env.HEALTH_URL || DEFAULT_HEALTH_URL;
  const ok = await waitForDeploy({
    expected,
    url,
    timeoutMs: Number(env.TIMEOUT_MINUTES || 20) * 60_000,
    intervalMs: Number(env.INTERVAL_SECONDS || 30) * 1000,
  });
  if (!ok) {
    console.error(`${url} did not report ${expected} before the timeout.`);
    return 1;
  }
  return 0;
}

if (require.main === module) {
  main().then((code) => process.exit(code));
}

module.exports = { decide, deployedContains, readDeployedSha, waitForDeploy };
