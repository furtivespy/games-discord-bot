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

function buildApp(env) {
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "health-static-"));
  fs.writeFileSync(
    path.join(staticDir, "index.html"),
    "<!doctype html><html><head></head><body>spa</body></html>"
  );
  const app = createEmbeddedApp({
    clientId: "client-123",
    clientSecret: "server-secret",
    staticDir,
    env,
  });
  return { app, staticDir };
}

describe("GET /health", () => {
  test("returns JSON with the build SHA instead of the SPA index", async () => {
    const { app, staticDir } = buildApp({ GIT_SHA: "abc123def456" });
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

  test("reports sha unknown when the image was built without GIT_SHA", async () => {
    const { app, staticDir } = buildApp({});
    const { server, url } = await listen(app);
    try {
      const res = await fetch(`${url}/health`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok", sha: "unknown" });
    } finally {
      server.close();
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  test("other unknown paths still fall through to the SPA", async () => {
    const { app, staticDir } = buildApp({ GIT_SHA: "abc123" });
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
