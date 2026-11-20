const { spawnSync } = require("child_process");

/**
 * Shared Chrome discovery for the headless-Chrome QA tests
 * (embedded-card-stacking, embedded-hover-zoom, embedded-inspect-nav).
 *
 * Environment:
 * - `CHROME_PATH`: use this binary before searching PATH.
 * - `SKIP_CHROME_TESTS=1`: never run Chrome tests (the required `test` job sets
 *   this; the separate `browser` job runs them).
 * - `REQUIRE_CHROME=1`: throw instead of skipping when no working Chrome is
 *   found, so a CI job that exists to run these tests cannot pass by skipping.
 *
 * With none of those set, tests run when a working Chrome exists and skip
 * quietly otherwise (the usual local case).
 */

const CANDIDATES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];

function whichBin(bin) {
  const result = spawnSync("which", [bin], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function chromeCandidates() {
  const found = [];
  if (process.env.CHROME_PATH) found.push(process.env.CHROME_PATH);
  for (const name of CANDIDATES) {
    const resolved = whichBin(name);
    if (resolved) found.push(resolved);
  }
  return [...new Set(found)];
}

/**
 * A stub (for example Ubuntu's snap `chromium-browser` wrapper) can answer
 * `--version` and then never paint. Load a page headless and make sure the DOM
 * comes back before trusting the binary.
 */
function probeChrome(bin) {
  try {
    const version = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 5000 });
    if (version.status !== 0) return { ok: false, reason: "--version failed" };
    const versionText = `${version.stdout || ""}${version.stderr || ""}`.trim();
    if (!/Chrom(e|ium)/i.test(versionText)) {
      return { ok: false, reason: `unrecognized version output: ${versionText}` };
    }

    const dom = spawnSync(
      bin,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--dump-dom",
        "data:text/html,<title>probe</title><p id=ok>ok</p>",
      ],
      { encoding: "utf8", timeout: 15000 }
    );
    if (dom.status !== 0 || !String(dom.stdout).includes('id="ok"')) {
      return { ok: false, reason: `--dump-dom did not paint (status ${dom.status})` };
    }
    return { ok: true, version: versionText };
  } catch (error) {
    return { ok: false, reason: String(error?.message || error) };
  }
}

let cached;

function workingChromeBin() {
  if (cached !== undefined) return cached;

  if (process.env.SKIP_CHROME_TESTS === "1") {
    cached = "";
    return cached;
  }

  const rejected = [];
  for (const bin of chromeCandidates()) {
    const probe = probeChrome(bin);
    if (probe.ok) {
      cached = bin;
      return cached;
    }
    rejected.push(`${bin}: ${probe.reason}`);
  }

  if (process.env.REQUIRE_CHROME === "1") {
    throw new Error(
      `REQUIRE_CHROME=1 but no working Chrome was found. ${
        rejected.length ? `Tried ${rejected.join("; ")}` : "Nothing on PATH or CHROME_PATH."
      }`
    );
  }

  cached = "";
  return cached;
}

module.exports = { workingChromeBin };
