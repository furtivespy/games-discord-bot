const { afterEach, describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  CONFIG_PLACEHOLDER,
  DISCORD_ME_URL,
  DISCORD_TOKEN_URL,
  createEmbeddedApp,
  displayNameFromDiscordUser,
  handleTokenExchange,
  hostFromPublicBaseUrl,
  injectEmbeddedConfig,
  resolveEmbeddedAppConfig,
  resolveInjectedApiHost,
  sanitizeApiHost,
  sanitizeClientId,
} = require("../modules/embeddedApp");
const VisualLaunch = require("../modules/visualLaunch");
const GameStore = require("../db/gameStore");
const GameDB = require("../db/anygame");
const { GAME_COLLECTION } = require("../modules/embeddedGames");

const SECRET_TOKEN = "SUPER_SECRET_ACCESS_TOKEN";

afterEach(() => {
  VisualLaunch.clearOrigins();
});

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function mockDiscordFetch({
  tokenStatus = 200,
  tokenBody = { access_token: SECRET_TOKEN },
  meStatus = 200,
  meBody = { username: "willsullivan", global_name: "Will" },
  calls = [],
} = {}) {
  return async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url) === DISCORD_TOKEN_URL) {
      return jsonResponse(tokenStatus, tokenBody);
    }
    if (String(url) === DISCORD_ME_URL) {
      return jsonResponse(meStatus, meBody);
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

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

describe("embedded app config", () => {
  test("prefers env over config.json and never requires Mongo", () => {
    const resolved = resolveEmbeddedAppConfig(
      {
        CLIENT_ID: "env-client",
        CLIENT_SECRET: "env-secret",
        PUBLIC_BASE_URL: "https://gamebot.example.com/",
        PORT: "4100",
      },
      {
        clientId: "config-client",
        clientSecret: "config-secret",
        publicBaseUrl: "https://ignored.example.com",
      }
    );
    expect(resolved).toEqual({
      clientId: "env-client",
      clientSecret: "env-secret",
      publicBaseUrl: "https://gamebot.example.com",
      apiHost: "gamebot.example.com",
      port: 4100,
    });
  });

  test("falls back to the bot's existing clientId", () => {
    const resolved = resolveEmbeddedAppConfig({}, { clientId: "548570412959662080" });
    expect(resolved.clientId).toBe("548570412959662080");
    expect(resolved.clientSecret).toBe("");
    expect(resolved.port).toBe(3000);
  });

  test("hostFromPublicBaseUrl strips scheme and path", () => {
    expect(hostFromPublicBaseUrl("https://gamebot.example.com/visual")).toBe(
      "gamebot.example.com"
    );
    expect(hostFromPublicBaseUrl("gamebot.example.com")).toBe("gamebot.example.com");
  });
});

describe("displayNameFromDiscordUser", () => {
  test("prefers global_name then username", () => {
    expect(
      displayNameFromDiscordUser({ global_name: "Will", username: "willsullivan" })
    ).toBe("Will");
    expect(displayNameFromDiscordUser({ username: "willsullivan" })).toBe(
      "willsullivan"
    );
    expect(displayNameFromDiscordUser({})).toBeNull();
  });

  test("skips blank global_name instead of dropping username", () => {
    expect(
      displayNameFromDiscordUser({ global_name: "   ", username: "willsullivan" })
    ).toBe("willsullivan");
  });
});

describe("handleTokenExchange", () => {
  test("exchanges code, resolves @me, and never logs the access token", async () => {
    const logs = [];
    const fetchCalls = [];
    const result = await handleTokenExchange({
      code: "oauth-code",
      clientId: "client-id",
      clientSecret: "client-secret",
      logger: { log: (message) => logs.push(String(message)) },
      fetchImpl: mockDiscordFetch({ calls: fetchCalls }),
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      access_token: SECRET_TOKEN,
      display_name: "Will",
    });
    expect(result.body.origin_channel_name).toBeUndefined();

    const tokenCall = fetchCalls.find((call) => call.url === DISCORD_TOKEN_URL);
    expect(tokenCall.options.method).toBe("POST");
    expect(tokenCall.options.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    );
    const body = String(tokenCall.options.body);
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code=oauth-code");
    expect(body).toContain("client_id=client-id");
    expect(body).toContain("client_secret=client-secret");

    const meCall = fetchCalls.find((call) => call.url === DISCORD_ME_URL);
    expect(meCall.options.headers.Authorization).toBe(`Bearer ${SECRET_TOKEN}`);

    expect(JSON.stringify(logs)).not.toContain(SECRET_TOKEN);
    expect(JSON.stringify(logs)).not.toContain("client-secret");
  });

  test("rejects a missing code and unconfigured secret", async () => {
    expect(await handleTokenExchange({ code: "" })).toEqual({
      status: 400,
      body: { error: "missing_code" },
    });
    expect(
      await handleTokenExchange({
        code: "abc",
        clientId: "client-id",
        clientSecret: "",
      })
    ).toEqual({
      status: 503,
      body: { error: "oauth_not_configured" },
    });
  });

  test("returns a resolvable origin channel name from a button launch", async () => {
    VisualLaunch.rememberOrigin("snowflake-user", {
      channelName: "Inis Friday",
      hostChannelId: "table-1",
    });
    const result = await handleTokenExchange({
      code: "oauth-code",
      clientId: "client-id",
      clientSecret: "client-secret",
      hostChannelId: "table-1",
      consumeOrigin: VisualLaunch.consumeOrigin,
      fetchImpl: mockDiscordFetch({
        meBody: {
          id: "snowflake-user",
          username: "willsullivan",
          global_name: "Will",
        },
      }),
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      access_token: SECRET_TOKEN,
      display_name: "Will",
      origin_channel_name: "Inis Friday",
    });
    expect(VisualLaunch.peekOrigin("snowflake-user")).toBeNull();
  });

  test("omits origin when there is no bridge context", async () => {
    const result = await handleTokenExchange({
      code: "oauth-code",
      clientId: "client-id",
      clientSecret: "client-secret",
      hostChannelId: "table-1",
      consumeOrigin: VisualLaunch.consumeOrigin,
      fetchImpl: mockDiscordFetch({
        meBody: {
          id: "snowflake-user",
          username: "willsullivan",
          global_name: "Will",
        },
      }),
    });
    expect(result.body.origin_channel_name).toBeUndefined();
    expect(result.body.display_name).toBe("Will");
  });

  test("does not return an access token when Discord rejects the code", async () => {
    const result = await handleTokenExchange({
      code: "bad",
      clientId: "client-id",
      clientSecret: "client-secret",
      fetchImpl: mockDiscordFetch({
        tokenStatus: 400,
        tokenBody: { error: "invalid_grant" },
      }),
    });
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ error: "token_exchange_failed" });
    expect(result.body.access_token).toBeUndefined();
  });
});

describe("embedded HTTP origin", () => {
  test("POST /api/token and GET / share one origin", async () => {
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-client-"));
    fs.writeFileSync(
      path.join(staticDir, "index.html"),
      `<!doctype html><html><head><script>${CONFIG_PLACEHOLDER}</script></head><body><p id="greeting">Connecting…</p><p id="origin" hidden></p></body></html>`
    );

    const app = createEmbeddedApp({
      clientId: "client-123",
      clientSecret: "server-secret",
      publicBaseUrl: "https://gamebot.example.com",
      staticDir,
      fetchImpl: mockDiscordFetch(),
    });
    const { server, url } = await listen(app);

    try {
      const page = await fetch(url);
      const html = await page.text();
      expect(page.status).toBe(200);
      expect(html).toContain("window.__GAMEBOT_EMBEDDED_CONFIG__=");
      expect(html).toContain('"clientId":"client-123"');
      expect(html).toContain('"apiHost":"gamebot.example.com"');
      expect(html).not.toContain("server-secret");
      expect(html).not.toContain(SECRET_TOKEN);
      expect(html).toContain('id="origin"');

      const token = await fetch(`${url}/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "oauth-code" }),
      });
      expect(token.status).toBe(200);
      expect(await token.json()).toEqual({
        access_token: SECRET_TOKEN,
        display_name: "Will",
      });

      const proxied = await fetch(`${url}/.proxy/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "oauth-code" }),
      });
      expect(proxied.status).toBe(200);
      expect(await proxied.json()).toMatchObject({ access_token: SECRET_TOKEN });

      VisualLaunch.rememberOrigin("snowflake-user", {
        channelName: "Inis Friday",
        hostChannelId: "table-1",
      });
      const bridgedApp = createEmbeddedApp({
        clientId: "client-123",
        clientSecret: "server-secret",
        publicBaseUrl: "https://gamebot.example.com",
        staticDir,
        fetchImpl: mockDiscordFetch({
          meBody: {
            id: "snowflake-user",
            username: "willsullivan",
            global_name: "Will",
          },
        }),
        consumeOrigin: VisualLaunch.consumeOrigin,
      });
      const bridged = await listen(bridgedApp);
      try {
        const bridgedToken = await fetch(`${bridged.url}/api/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "oauth-code", channel_id: "table-1" }),
        });
        expect(await bridgedToken.json()).toEqual({
          access_token: SECRET_TOKEN,
          display_name: "Will",
          origin_channel_name: "Inis Friday",
        });
      } finally {
        bridged.server.close();
      }
    } finally {
      server.close();
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  test("injectEmbeddedConfig replaces the placeholder only", () => {
    const html = `<head><script>${CONFIG_PLACEHOLDER}</script></head>`;
    const injected = injectEmbeddedConfig(html, {
      clientId: "abc",
      apiHost: "gamebot.example.com",
    });
    expect(injected).toContain(
      'window.__GAMEBOT_EMBEDDED_CONFIG__={"clientId":"abc","apiHost":"gamebot.example.com"};'
    );
    expect(injected).not.toContain(CONFIG_PLACEHOLDER);
  });

  test("does not inject Discord proxy hosts or HTML-breaking values", () => {
    expect(
      resolveInjectedApiHost({
        requestHost: "123456.discordsays.com",
      })
    ).toBe("");
    expect(sanitizeApiHost("</script>.example.com")).toBe("");
    expect(sanitizeClientId("</script><script>alert(1)")).toBe("");
    const injected = injectEmbeddedConfig(
      `<head><script>${CONFIG_PLACEHOLDER}</script></head>`,
      {
        clientId: "</script><script>alert(1)",
        apiHost: "123.discordsays.com",
      }
    );
    expect(injected).toContain(
      'window.__GAMEBOT_EMBEDDED_CONFIG__={"clientId":"","apiHost":""};'
    );
    expect(injected).not.toContain("</script><script>");
  });

  test("source client greets, then offers a game picker", () => {
    const html = fs.readFileSync(
      path.join(__dirname, "..", "embedded-client", "index.html"),
      "utf8"
    );
    expect(html).toContain('id="greeting"');
    expect(html).toContain('id="origin"');
    expect(html).toContain('id="game-picker"');
    expect(html).toContain('id="game-select"');
    expect(html).toContain("Select a game");
    expect(html).toContain('id="selected-channel"');
    expect(html).toContain('id="games-empty"');
    expect(html).toContain("You're not in any active games on this server.");
    expect(html).toContain('id="table"');
    expect(html).toContain("Hand");
    expect(html).toContain("My play area");
    expect(html).toContain("Game board");
    const css = fs.readFileSync(
      path.join(__dirname, "..", "embedded-client", "src", "style.css"),
      "utf8"
    );
    expect(css).toContain("#game-picker[hidden]");
    expect(css).toContain("#table[hidden]");
    expect(css).toContain(".card-tile.dragging");
  });
});

describe("GET /api/games", () => {
  async function withStore(run) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-list-"));
    const previous = process.env.GAMEBOT_DATA_DIR;
    process.env.GAMEBOT_DATA_DIR = dataDir;
    const store = new GameStore();
    try {
      return await run(store);
    } finally {
      try {
        store.db.close();
      } catch {}
      if (previous === undefined) delete process.env.GAMEBOT_DATA_DIR;
      else process.env.GAMEBOT_DATA_DIR = previous;
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  }

  test("lists this user's active guild games newest first and ignores origin memory", async () => {
    await withStore(async (store) => {
      store.upsertGameData("guild-1", GAME_COLLECTION, "thread-new", {
        isdeleted: false,
        name: "Should not leak custom title",
        players: [{ userId: "snowflake-user" }],
        history: [
          {
            timestamp: "2026-11-10T00:00:00.000Z",
            action: {
              category: GameDB.ACTION_CATEGORIES.GAME,
              type: GameDB.ACTION_TYPES.CREATE,
            },
          },
        ],
      });
      store.upsertGameData("guild-1", GAME_COLLECTION, "thread-old", {
        isdeleted: false,
        name: "Old table",
        players: [{ userId: "snowflake-user" }],
        history: [
          {
            timestamp: "2026-01-01T00:00:00.000Z",
            action: {
              category: GameDB.ACTION_CATEGORIES.GAME,
              type: GameDB.ACTION_TYPES.CREATE,
            },
          },
        ],
      });
      store.upsertGameData("guild-1", GAME_COLLECTION, "thread-deleted", {
        isdeleted: true,
        name: "Deleted",
        players: [{ userId: "snowflake-user" }],
        history: [
          {
            timestamp: "2026-12-01T00:00:00.000Z",
            action: {
              category: GameDB.ACTION_CATEGORIES.GAME,
              type: GameDB.ACTION_TYPES.CREATE,
            },
          },
        ],
      });
      store.upsertGameData("guild-1", GAME_COLLECTION, "other-player", {
        isdeleted: false,
        name: "Not mine",
        players: [{ userId: "someone-else" }],
        history: [
          {
            timestamp: "2026-11-20T00:00:00.000Z",
            action: {
              category: GameDB.ACTION_CATEGORIES.GAME,
              type: GameDB.ACTION_TYPES.CREATE,
            },
          },
        ],
      });
      store.upsertGameData("guild-2", GAME_COLLECTION, "other-guild", {
        isdeleted: false,
        name: "Other server",
        players: [{ userId: "snowflake-user" }],
        history: [
          {
            timestamp: "2026-11-30T00:00:00.000Z",
            action: {
              category: GameDB.ACTION_CATEGORIES.GAME,
              type: GameDB.ACTION_TYPES.CREATE,
            },
          },
        ],
      });

      VisualLaunch.rememberOrigin("snowflake-user", {
        channelName: "Origin Bridge Channel",
        hostChannelId: "launch-channel",
      });

      const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-games-http-"));
      fs.writeFileSync(
        path.join(staticDir, "index.html"),
        `<!doctype html><html><head><script>${CONFIG_PLACEHOLDER}</script></head><body></body></html>`
      );
      const app = createEmbeddedApp({
        clientId: "client-123",
        clientSecret: "server-secret",
        staticDir,
        gameStore: store,
        consumeOrigin: VisualLaunch.consumeOrigin,
        fetchChannelName: async (channelId) =>
          ({
            "thread-new": "Friday Inis",
            "thread-old": "Monday Poker",
          })[channelId] || null,
        fetchImpl: mockDiscordFetch({
          meBody: {
            id: "snowflake-user",
            username: "willsullivan",
            global_name: "Will",
          },
        }),
      });
      const { server, url } = await listen(app);
      try {
        const missingAuth = await fetch(`${url}/api/games?guildId=guild-1`);
        expect(missingAuth.status).toBe(401);

        const missingGuild = await fetch(`${url}/api/games`, {
          headers: { Authorization: `Bearer ${SECRET_TOKEN}` },
        });
        expect(missingGuild.status).toBe(400);
        expect(await missingGuild.json()).toEqual({ error: "missing_guild" });

        const listed = await fetch(`${url}/api/games?guildId=guild-1`, {
          headers: { Authorization: `Bearer ${SECRET_TOKEN}` },
        });
        expect(listed.status).toBe(200);
        expect(await listed.json()).toEqual({
          games: [
            { channelId: "thread-new", channelName: "Friday Inis" },
            { channelId: "thread-old", channelName: "Monday Poker" },
          ],
        });

        const proxied = await fetch(`${url}/.proxy/api/games?guildId=guild-1`, {
          headers: { Authorization: `Bearer ${SECRET_TOKEN}` },
        });
        expect(proxied.status).toBe(200);
        expect((await proxied.json()).games[0].channelName).toBe("Friday Inis");

        expect(VisualLaunch.peekOrigin("snowflake-user")?.channelName).toBe(
          "Origin Bridge Channel"
        );
      } finally {
        server.close();
        fs.rmSync(staticDir, { recursive: true, force: true });
      }
    });
  });

  test("one corrupt game_documents row does not 500 the guild list", async () => {
    await withStore(async (store) => {
      store.upsertGameData("guild-1", GAME_COLLECTION, "thread-good", {
        isdeleted: false,
        name: "Good table",
        players: [{ userId: "snowflake-user" }],
        history: [
          {
            timestamp: "2026-11-10T00:00:00.000Z",
            action: {
              category: GameDB.ACTION_CATEGORIES.GAME,
              type: GameDB.ACTION_TYPES.CREATE,
            },
          },
        ],
      });
      store.db
        .query(
          `INSERT INTO game_documents (guild_id, collection, channel_id, data, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))`
        )
        .run("guild-1", GAME_COLLECTION, "thread-bad", "{not json");

      const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-games-bad-"));
      fs.writeFileSync(
        path.join(staticDir, "index.html"),
        `<!doctype html><html><head></head><body></body></html>`
      );
      const app = createEmbeddedApp({
        clientId: "client-123",
        clientSecret: "server-secret",
        staticDir,
        gameStore: store,
        fetchImpl: mockDiscordFetch({
          meBody: {
            id: "snowflake-user",
            username: "willsullivan",
            global_name: "Will",
          },
        }),
      });
      const { server, url } = await listen(app);
      try {
        const listed = await fetch(`${url}/api/games?guildId=guild-1`, {
          headers: { Authorization: `Bearer ${SECRET_TOKEN}` },
        });
        expect(listed.status).toBe(200);
        expect(await listed.json()).toEqual({
          games: [{ channelId: "thread-good", channelName: "Good table" }],
        });
      } finally {
        server.close();
        fs.rmSync(staticDir, { recursive: true, force: true });
      }
    });
  });
});

describe("GET /api/game/snapshot", () => {
  async function withStore(run) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-snap-"));
    const previous = process.env.GAMEBOT_DATA_DIR;
    process.env.GAMEBOT_DATA_DIR = dataDir;
    const store = new GameStore();
    try {
      return await run(store);
    } finally {
      try {
        store.db.close();
      } catch {}
      if (previous === undefined) delete process.env.GAMEBOT_DATA_DIR;
      else process.env.GAMEBOT_DATA_DIR = previous;
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  }

  function snapshotGame(userId = "snowflake-user") {
    return {
      isdeleted: false,
      name: "Friday Inis",
      players: [
        {
          userId,
          hands: {
            main: [
              { id: "hand-1", name: "Copper", url: null },
              {
                id: "hand-2",
                name: "Gold",
                url: "https://gamebot.example.com/gold.png",
              },
            ],
            draft: [{ id: "draft-1", name: "Draft Only" }],
          },
          playArea: [{ id: "play-1", name: "Village" }],
        },
        {
          userId: "other-player",
          hands: { main: [{ id: "secret", name: "Other Player Secret" }] },
          playArea: [{ id: "other-play", name: "Other Play Area" }],
        },
      ],
      gameBoard: [{ id: "board-1", name: "Province" }],
    };
  }

  test("loads the picker-selected channel with Bearer auth and never leaks another hand", async () => {
    await withStore(async (store) => {
      store.upsertGameData("guild-1", GAME_COLLECTION, "thread-game", snapshotGame());
      const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-snap-http-"));
      fs.writeFileSync(
        path.join(staticDir, "index.html"),
        `<!doctype html><html><head><script>${CONFIG_PLACEHOLDER}</script></head><body></body></html>`
      );
      const loads = [];
      const app = createEmbeddedApp({
        clientId: "client-123",
        clientSecret: "server-secret",
        staticDir,
        gameStore: store,
        getGameData: async (guildId, collection, channelId) => {
          loads.push({ guildId, collection, channelId });
          return store.getSpecificGameData(guildId, collection, channelId);
        },
        fetchImpl: mockDiscordFetch({
          meBody: {
            id: "snowflake-user",
            username: "willsullivan",
            global_name: "Will",
          },
        }),
      });
      const { server, url } = await listen(app);
      try {
        const missingAuth = await fetch(
          `${url}/api/game/snapshot?guildId=guild-1&channelId=thread-game`
        );
        expect(missingAuth.status).toBe(401);

        const missingChannel = await fetch(`${url}/api/game/snapshot?guildId=guild-1`, {
          headers: { Authorization: `Bearer ${SECRET_TOKEN}` },
        });
        expect(missingChannel.status).toBe(400);
        expect(await missingChannel.json()).toEqual({ error: "missing_channel" });

        const launchChannel = await fetch(
          `${url}/api/game/snapshot?guildId=guild-1&channelId=activity-launch`,
          { headers: { Authorization: `Bearer ${SECRET_TOKEN}` } }
        );
        expect(launchChannel.status).toBe(404);
        expect(await launchChannel.json()).toEqual({ error: "no_game" });

        const snapshot = await fetch(
          `${url}/api/game/snapshot?guildId=guild-1&channelId=thread-game`,
          { headers: { Authorization: `Bearer ${SECRET_TOKEN}` } }
        );
        expect(snapshot.status).toBe(200);
        const body = await snapshot.json();
        expect(body).toEqual({
          gameName: "Friday Inis",
          channelId: "thread-game",
          guildId: "guild-1",
          hand: [
            { id: "hand-1", name: "Copper", url: null },
            {
              id: "hand-2",
              name: "Gold",
              url: "https://gamebot.example.com/gold.png",
            },
          ],
          playArea: [{ id: "play-1", name: "Village" }],
          gameBoard: [{ id: "board-1", name: "Province" }],
        });
        expect(JSON.stringify(body)).not.toContain("Other Player Secret");
        expect(JSON.stringify(body)).not.toContain("Draft Only");
        expect(loads).toEqual([
          {
            guildId: "guild-1",
            collection: GAME_COLLECTION,
            channelId: "activity-launch",
          },
          {
            guildId: "guild-1",
            collection: GAME_COLLECTION,
            channelId: "thread-game",
          },
        ]);

        const proxied = await fetch(
          `${url}/.proxy/api/game/snapshot?guildId=guild-1&channelId=thread-game`,
          { headers: { Authorization: `Bearer ${SECRET_TOKEN}` } }
        );
        expect(proxied.status).toBe(200);
        expect((await proxied.json()).channelId).toBe("thread-game");
      } finally {
        server.close();
        fs.rmSync(staticDir, { recursive: true, force: true });
      }
    });
  });

  test("non-player gets a clear error and no cards", async () => {
    await withStore(async (store) => {
      store.upsertGameData(
        "guild-1",
        GAME_COLLECTION,
        "thread-game",
        snapshotGame("someone-else")
      );
      const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-snap-np-"));
      fs.writeFileSync(
        path.join(staticDir, "index.html"),
        `<!doctype html><html><head></head><body></body></html>`
      );
      const app = createEmbeddedApp({
        clientId: "client-123",
        clientSecret: "server-secret",
        staticDir,
        gameStore: store,
        fetchImpl: mockDiscordFetch({
          meBody: {
            id: "snowflake-user",
            username: "willsullivan",
            global_name: "Will",
          },
        }),
      });
      const { server, url } = await listen(app);
      try {
        const response = await fetch(
          `${url}/api/game/snapshot?guildId=guild-1&channelId=thread-game`,
          { headers: { Authorization: `Bearer ${SECRET_TOKEN}` } }
        );
        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body).toEqual({ error: "not_a_player" });
        expect(JSON.stringify(body)).not.toMatch(/Copper|Village|Province|Other Player Secret/);
      } finally {
        server.close();
        fs.rmSync(staticDir, { recursive: true, force: true });
      }
    });
  });
});
