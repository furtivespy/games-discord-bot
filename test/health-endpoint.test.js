const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createEmbeddedApp } = require("../modules/embeddedApp");

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
    server.on("error", reject);
  });
}

// `gitSha` is the contents of the image's GIT_SHA file; omit it for "no file".
// Always points at a temp path so tests never read a real /app/GIT_SHA.
function buildApp(env, { gitSha } = {}) {
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "health-static-"));
  fs.writeFileSync(
    path.join(staticDir, "index.html"),
    "<!doctype html><html><head></head><body>spa</body></html>"
  );
  const gitShaFile = path.join(staticDir, "GIT_SHA");
  if (gitSha !== undefined) fs.writeFileSync(gitShaFile, gitSha);
  const app = createEmbeddedApp({
    clientId: "client-123",
    clientSecret: "server-secret",
    staticDir,
    env,
    gitShaFile,
  });
  return { app, staticDir };
}

async function healthSha({ env, gitSha }) {
  const { app, staticDir } = buildApp(env, { gitSha });
  const { server, url } = await listen(app);
  try {
    const res = await fetch(`${url}/health`);
    return (await res.json()).sha;
  } finally {
    server.close();
    fs.rmSync(staticDir, { recursive: true, force: true });
  }
}

describe("GET /health", () => {
  test("returns JSON with the build SHA instead of the SPA index", async () => {
    const { app, staticDir } = buildApp({}, { gitSha: "abc123def456" });
    const { server, url } = await listen(app);
    try {
      const res = await fetch(`${url}/health`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({ status: "ok", sha: "abc123def456" });
    } finally {
      server.close();
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  test("trims whitespace around the SHA in the file", async () => {
    expect(await healthSha({ env: {}, gitSha: "abc123\n" })).toBe("abc123");
  });

  test("a stale GIT_SHA env var cannot shadow the image's file", async () => {
    // freshdock copies the old container's env, including the previous image's
    // baked-in GIT_SHA, into the recreated container.
    expect(
      await healthSha({ env: { GIT_SHA: "stale-old-sha" }, gitSha: "new-sha" })
    ).toBe("new-sha");
  });

  test("falls back to the GIT_SHA env var when there is no file", async () => {
    expect(await healthSha({ env: { GIT_SHA: "from-env" } })).toBe("from-env");
  });

  test("falls back to the GIT_SHA env var when the file is empty", async () => {
    expect(
      await healthSha({ env: { GIT_SHA: "from-env" }, gitSha: "  \n" })
    ).toBe("from-env");
  });

  test("reports sha unknown when there is neither a file nor GIT_SHA", async () => {
    expect(await healthSha({ env: {} })).toBe("unknown");
  });

  test("reports sha unknown when the image was built without GIT_SHA", async () => {
    // Dockerfile writes the ARG default ("unknown") into the file.
    expect(await healthSha({ env: {}, gitSha: "unknown" })).toBe("unknown");
  });

  test("other unknown paths still fall through to the SPA", async () => {
    const { app, staticDir } = buildApp({}, { gitSha: "abc123" });
    const { server, url } = await listen(app);
    try {
      const res = await fetch(`${url}/not-a-route`);
      expect(res.headers.get("content-type")).toContain("text/html");
      expect(await res.text()).toContain("spa");
    } finally {
      server.close();
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });
});
