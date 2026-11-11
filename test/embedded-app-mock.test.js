const { afterEach, describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  CONFIG_PLACEHOLDER,
  createEmbeddedApp,
  injectEmbeddedConfig,
  startEmbeddedAppServer,
} = require("../modules/embeddedApp");
const {
  DEFAULT_MOCK_CHANNEL_ID,
  DEFAULT_MOCK_CLIENT_ID,
  DEFAULT_MOCK_GUILD_ID,
  ENV_NAME,
  MOCK_ACCESS_TOKEN,
  MOCK_USER,
  getMockSnapshot,
  isEmbeddedAppMockEnabled,
  otherPlayerHand,
  populatedSeed,
  snapshotFromSeed,
} = require("../modules/embeddedAppMock");

const DEV_ENV = { NODE_ENV: "test" };
const SECRET_TOKEN = "SUPER_SECRET_ACCESS_TOKEN";

afterEach(() => {
  delete process.env[ENV_NAME];
});

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
    server.on("error", reject);
  });
}

function makeStaticDir() {
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-mock-"));
  fs.writeFileSync(
    path.join(staticDir, "index.html"),
    `<!doctype html><html><head><script>${CONFIG_PLACEHOLDER}</script></head><body><p id="greeting">Connecting…</p><p id="origin" hidden></p><div id="table" hidden></div></body></html>`
  );
  return staticDir;
}

describe("isEmbeddedAppMockEnabled", () => {
  test("is off by default and treats 1/true/yes/on as requested", () => {
    expect(isEmbeddedAppMockEnabled({})).toBe(false);
    for (const value of ["1", "true", "TRUE", " yes ", "On"]) {
      expect(isEmbeddedAppMockEnabled({ [ENV_NAME]: value })).toBe(true);
    }
  });

  test("treats empty, 0, false, no, and off as unset", () => {
    for (const value of ["", "0", "false", "no", "off", "  "]) {
      expect(isEmbeddedAppMockEnabled({ [ENV_NAME]: value })).toBe(false);
    }
  });

  test("is impossible to enable when NODE_ENV is production", () => {
    expect(
      isEmbeddedAppMockEnabled({
        [ENV_NAME]: "1",
        NODE_ENV: "production",
      })
    ).toBe(false);
    expect(
      isEmbeddedAppMockEnabled({
        [ENV_NAME]: "true",
        NODE_ENV: "PRODUCTION",
      })
    ).toBe(false);
  });
});

describe("mock snapshot fixtures", () => {
  test("populated layout has this player's hand, play area, and board only", () => {
    const result = getMockSnapshot({ fixture: "populated" });
    expect(result.status).toBe(200);
    expect(result.body.gameName).toBe("Fixture Game");
    expect(result.body.channelId).toBe(DEFAULT_MOCK_CHANNEL_ID);
    expect(result.body.guildId).toBe(DEFAULT_MOCK_GUILD_ID);
    expect(result.body.hand.map((card) => card.id)).toEqual([
      "hand-1",
      "hand-2",
      "hand-3",
    ]);
    expect(result.body.playArea.map((card) => card.name)).toEqual([
      "Village",
      "Market",
    ]);
    expect(result.body.gameBoard.map((card) => card.name)).toEqual([
      "Province",
      "Duchy",
      "Estate",
    ]);
    expect(result.body.players).toBeUndefined();
  });

  test("never includes another player's hand, draft, or simultaneous cards", () => {
    const seed = populatedSeed();
    expect(otherPlayerHand()[0].name).toBe("Other Player Secret");
    const snapshot = snapshotFromSeed(seed, {
      channelId: "ch",
      guildId: "g",
    });
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain("Other Player Secret");
    expect(json).not.toContain("other-secret-1");
    expect(json).not.toContain("other-player-2");
    expect(json).not.toContain("Other Play Area");
    expect(json).not.toContain("Draft Only");
    expect(json).not.toContain("Simultaneous Only");
    expect(json).not.toContain(MOCK_ACCESS_TOKEN);
    expect(snapshot.hand.some((card) => card.id === "draft-1")).toBe(false);
  });

  test("no-game and not-a-player are errors with no cards", () => {
    const noGame = getMockSnapshot({ fixture: "no-game" });
    expect(noGame).toEqual({ status: 404, body: { error: "no_game" } });
    expect(noGame.body.hand).toBeUndefined();
    expect(noGame.body.playArea).toBeUndefined();
    expect(noGame.body.gameBoard).toBeUndefined();

    const notPlayer = getMockSnapshot({ fixture: "not-a-player" });
    expect(notPlayer).toEqual({
      status: 403,
      body: { error: "not_a_player" },
    });
    expect(JSON.stringify(notPlayer.body)).not.toMatch(/Copper|Village|Province/);
  });

  test("unknown fixture is rejected", () => {
    expect(getMockSnapshot({ fixture: "secret-hand" })).toEqual({
      status: 400,
      body: { error: "unknown_fixture" },
    });
  });
});

describe("mock embedded HTTP", () => {
  test("POST /api/token returns a fixture user and never talks to Discord", async () => {
    const staticDir = makeStaticDir();
    const fetchCalls = [];
    const app = createEmbeddedApp({
      clientId: "client-123",
      clientSecret: "server-secret",
      mock: true,
      env: DEV_ENV,
      staticDir,
      fetchImpl: async (url) => {
        fetchCalls.push(String(url));
        throw new Error("Discord must not be called in mock mode");
      },
    });
    const { server, url } = await listen(app);

    try {
      const token = await fetch(`${url}/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(token.status).toBe(200);
      expect(await token.json()).toEqual({
        access_token: MOCK_ACCESS_TOKEN,
        display_name: MOCK_USER.global_name,
        origin_channel_name: "Mock Table",
      });

      const proxied = await fetch(`${url}/.proxy/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "anything" }),
      });
      expect(proxied.status).toBe(200);
      expect(await proxied.json()).toMatchObject({
        display_name: MOCK_USER.global_name,
      });
      expect(fetchCalls).toEqual([]);
    } finally {
      server.close();
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  test("GET /api/game/snapshot serves selectable fixtures", async () => {
    const staticDir = makeStaticDir();
    const app = createEmbeddedApp({
      mock: true,
      mockChannelId: "table-9",
      mockGuildId: "guild-9",
      env: DEV_ENV,
      staticDir,
    });
    const { server, url } = await listen(app);

    try {
      const populated = await fetch(`${url}/api/game/snapshot`);
      expect(populated.status).toBe(200);
      const body = await populated.json();
      expect(body.channelId).toBe("table-9");
      expect(body.guildId).toBe("guild-9");
      expect(body.hand).toHaveLength(3);
      expect(JSON.stringify(body)).not.toContain("Other Player Secret");

      const noGame = await fetch(`${url}/api/game/snapshot?fixture=no-game`);
      expect(noGame.status).toBe(404);
      expect(await noGame.json()).toEqual({ error: "no_game" });

      const notPlayer = await fetch(
        `${url}/.proxy/api/game/snapshot?fixture=not-a-player`
      );
      expect(notPlayer.status).toBe(403);
      expect(await notPlayer.json()).toEqual({ error: "not_a_player" });

      const override = await fetch(
        `${url}/api/game/snapshot?channelId=from-query&guildId=g-query`
      );
      expect(await override.json()).toMatchObject({
        channelId: "from-query",
        guildId: "g-query",
      });
    } finally {
      server.close();
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  test("injects mock config into the page and uses a dummy client id when missing", async () => {
    const staticDir = makeStaticDir();
    const app = createEmbeddedApp({
      mock: true,
      env: DEV_ENV,
      staticDir,
    });
    const { server, url } = await listen(app);

    try {
      const page = await fetch(url);
      const html = await page.text();
      expect(html).toContain('"mock":true');
      expect(html).toContain(`"clientId":"${DEFAULT_MOCK_CLIENT_ID}"`);
      expect(html).toContain(`"channelId":"${DEFAULT_MOCK_CHANNEL_ID}"`);
      expect(html).toContain(`"guildId":"${DEFAULT_MOCK_GUILD_ID}"`);
      expect(html).not.toContain("server-secret");
    } finally {
      server.close();
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  test("with mock disabled, snapshot is missing and token still uses OAuth", async () => {
    const staticDir = makeStaticDir();
    const app = createEmbeddedApp({
      clientId: "client-123",
      clientSecret: "",
      mock: false,
      env: DEV_ENV,
      staticDir,
    });
    const { server, url } = await listen(app);

    try {
      const snapshot = await fetch(`${url}/api/game/snapshot`);
      expect(snapshot.status).toBe(404);
      expect(await snapshot.json()).toEqual({ error: "not_found" });

      const token = await fetch(`${url}/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "oauth-code" }),
      });
      expect(token.status).toBe(503);
      expect(await token.json()).toEqual({ error: "oauth_not_configured" });

      const page = await fetch(url);
      const html = await page.text();
      expect(html).not.toContain('"mock":true');
    } finally {
      server.close();
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  test("NODE_ENV=production ignores mock even when the flag and createEmbeddedApp ask for it", async () => {
    const staticDir = makeStaticDir();
    const fetchCalls = [];
    const app = createEmbeddedApp({
      clientId: "client-123",
      clientSecret: "",
      mock: true,
      env: { NODE_ENV: "production", [ENV_NAME]: "1" },
      staticDir,
      fetchImpl: async (url) => {
        fetchCalls.push(String(url));
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: SECRET_TOKEN }),
        };
      },
    });
    const { server, url } = await listen(app);

    try {
      const token = await fetch(`${url}/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "oauth-code" }),
      });
      expect(token.status).toBe(503);
      expect(await token.json()).toEqual({ error: "oauth_not_configured" });

      const snapshot = await fetch(`${url}/api/game/snapshot`);
      expect(snapshot.status).toBe(404);

      const page = await fetch(url);
      expect(await page.text()).not.toContain('"mock":true');
      expect(fetchCalls).toEqual([]);
    } finally {
      server.close();
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  test("startEmbeddedAppServer honors EMBEDDED_APP_MOCK outside production", () => {
    const staticDir = makeStaticDir();
    try {
      const { app, server } = startEmbeddedAppServer({
        listen: false,
        env: {
          NODE_ENV: "test",
          [ENV_NAME]: "1",
          CLIENT_ID: "client-123",
        },
        config: {},
      });
      expect(server).toBeNull();
      expect(app).toBeTruthy();
    } finally {
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });
});

describe("injectEmbeddedConfig mock payload", () => {
  test("omits mock fields unless mock is on", () => {
    const html = `<head><script>${CONFIG_PLACEHOLDER}</script></head>`;
    expect(
      injectEmbeddedConfig(html, {
        clientId: "abc",
        apiHost: "gamebot.example.com",
      })
    ).toContain(
      'window.__GAMEBOT_EMBEDDED_CONFIG__={"clientId":"abc","apiHost":"gamebot.example.com"};'
    );
    expect(
      injectEmbeddedConfig(html, {
        clientId: "abc",
        apiHost: "gamebot.example.com",
        mock: true,
        channelId: "ch-1",
        guildId: "g-1",
      })
    ).toContain(
      'window.__GAMEBOT_EMBEDDED_CONFIG__={"clientId":"abc","apiHost":"gamebot.example.com","mock":true,"channelId":"ch-1","guildId":"g-1"};'
    );
  });
});
