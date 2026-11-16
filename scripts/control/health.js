"use strict";

// `health`: what commit is the bot serving? Wraps scripts/check-deployed-version.js.

const {
  decide,
  readDeployedSha,
  waitForDeploy,
} = require("../check-deployed-version");

const PRODUCTION_ORIGIN = "https://gamebot.willsullivan.dev";

function healthUrl(origin) {
  return `${String(origin || PRODUCTION_ORIGIN).replace(/\/+$/, "")}/health`;
}

// Without `expected`: report the deployed sha. With it: say whether that commit
// is running (`match`), contained in what is running (`newer`), or not yet
// (`wait`). `wait: true` polls like the post-merge deploy check.
async function checkHealth({
  origin,
  expected,
  wait = false,
  timeoutMs = 20 * 60_000,
  intervalMs = 30_000,
  fetchImpl = fetch,
  log = () => {},
} = {}) {
  const url = healthUrl(origin);
  if (expected && wait) {
    const ok = await waitForDeploy({ expected, url, timeoutMs, intervalMs, fetchImpl, log });
    const deployed = await readDeployedSha(url, fetchImpl);
    return { ok, url, deployed, expected, outcome: ok ? "shipped" : "timeout" };
  }
  const deployed = await readDeployedSha(url, fetchImpl);
  if (!expected) {
    return { ok: deployed !== null, url, deployed, outcome: deployed ? "reachable" : "unreachable" };
  }
  const outcome = decide({ deployed, expected });
  return { ok: outcome !== "wait", url, deployed, expected, outcome };
}

module.exports = { PRODUCTION_ORIGIN, checkHealth, healthUrl };
