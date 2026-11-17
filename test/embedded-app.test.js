const { afterEach, describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  CONFIG_PLACEHOLDER,
  DISCORD_ME_URL,
  DISCORD_TOKEN_URL,
  DISCORD_USER_CACHE_TTL_MS,
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
const { drainLockedVisualActions } = require("../modules/embeddedActions");
const GameStore = require("../db/gameStore");
const GameDB = require("../db/anygame");
const { DISCORD_API_BASE, GAME_COLLECTION } = require("../modules/embeddedGames");
const {
  cardImagePath,
  deriveImageProxyKey,
} = require("../modules/embeddedImageProxy");

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
    expect(html).toContain("Play Area");
    expect(html).toContain("Game Board");
    expect(html).toContain('id="side-panel"');
    expect(html).toContain('id="other-players"');
    expect(html).toContain('id="game-status"');
    expect(html).toContain('id="game-channel-link"');
    expect(html).toContain('id="action-notice"');
    expect(html).toContain('id="action-dialog"');
    expect(html).toContain('id="decks"');
    expect(html).toContain("hand-fan");
    expect(html).toContain('id="card-inspect"');
    expect(html).toContain('id="card-inspect-art"');
    expect(html).toContain('id="card-inspect-caption"');
    const css = fs.readFileSync(
      path.join(__dirname, "..", "embedded-client", "src", "style.css"),
      "utf8"
    );
    expect(css).toContain("#game-picker[hidden]");
    expect(css).toContain("#table[hidden]");
    expect(css).toContain(".card-tile.dragging");
    expect(css).toContain(".card-tile.moved");
    expect(css).toContain(".card-tile.snapping");
    expect(css).not.toContain(".zone:has(.dragging)");
    expect(css).not.toContain(".zone:has(.moved)");
    expect(css).not.toContain(".zone:has(.card-tile:hover)");
    const zoneBlock = css.slice(css.indexOf(".zone {"), css.indexOf("}", css.indexOf(".zone {")) + 1);
    expect(zoneBlock).toContain("overflow: visible");
    expect(zoneBlock).not.toMatch(/z-index/);
    expect(css).toContain("z-index: 20");
    expect(css).toContain(".card-tile:hover .card-face");
    expect(css).toContain(".card-tile.dragging .card-face");
    expect(css).not.toContain(".card-tile.dragging:hover .card-face");
    expect(css).not.toContain(".deck-tile:hover .card-face");
    expect(css).toContain("--card-hover-scale: 1.48");
    expect(css).toContain("scale(var(--card-hover-scale))");
    expect(css).not.toContain("scale(1.28)");
    expect(css).toMatch(/\.card-tile img[\s\S]*object-fit:\s*contain/);
    expect(css).toContain(".card-inspect-dialog");
    expect(css).toContain(".card-inspect-description");
    expect(css).toContain(".deck-tile:hover .deck-actions");
    expect(css).toContain(".deck-tile:has(:focus-visible) .deck-actions");
    expect(css).toMatch(/\.deck-actions\s*\{[^}]*bottom:\s*2rem/);
    expect(css).not.toContain(".deck-tile:focus-within");
    expect(css).toContain(".deck-action");
    expect(css).toContain(".hand-fan .card-tile + .card-tile");
    expect(css).toContain(".player-team-group");
    expect(css).toContain(".status-player-score");
    expect(css).not.toContain(".status-title");
    expect(css).not.toContain(".status-player-meta");
  });

  test("card rows stay visible so drag and hover zoom are not clipped by the row", () => {
    const css = fs
      .readFileSync(
        path.join(__dirname, "..", "embedded-client", "src", "style.css"),
        "utf8"
      )
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const html = fs.readFileSync(
      path.join(__dirname, "..", "embedded-client", "index.html"),
      "utf8"
    );
    expect(html).toMatch(/class="cards board-spread" id="board-cards"/);
    expect(html).toMatch(/class="cards board-spread" id="play-area-cards"/);
    expect(html).toMatch(/class="cards hand-fan" id="hand-cards"/);

    const ruleBody = (selector) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
      expect(match).toBeTruthy();
      return match[1];
    };
    const overflowIsVisible = (body) => {
      expect(body).toMatch(/overflow:\s*visible/);
      expect(body).not.toMatch(/overflow-x:\s*(auto|scroll|hidden)/);
      expect(body).not.toMatch(/overflow-y:\s*(auto|scroll|hidden)/);
      expect(body).not.toMatch(/overflow:\s*(auto|scroll|hidden)/);
    };

    expect(ruleBody("#table")).toMatch(/overflow:\s*auto/);
    expect(ruleBody("#table")).not.toMatch(/overflow:\s*visible/);
    overflowIsVisible(ruleBody(".zone"));
    overflowIsVisible(ruleBody(".cards"));
    overflowIsVisible(ruleBody(".board-spread"));
    overflowIsVisible(ruleBody(".hand-fan"));
    expect(ruleBody(".board-spread")).toMatch(/flex-wrap:\s*wrap/);
    expect(ruleBody(".cards")).toMatch(/min-height:\s*2\.5rem/);
    expect(ruleBody(".zone")).toMatch(/min-height:\s*0/);
    expect(ruleBody(".zone")).not.toMatch(/min-height:\s*8\.5rem/);
    expect(ruleBody(".cards")).not.toMatch(/min-height:\s*7\.55rem/);
    expect(ruleBody(".card-face")).toMatch(/box-sizing:\s*border-box/);
    expect(ruleBody("#table")).toMatch(/isolation:\s*isolate/);
    expect(ruleBody(".zone")).not.toMatch(/z-index\s*:/);
    expect(ruleBody(".zone")).not.toMatch(/transform\s*:/);
    expect(ruleBody(".board-row")).not.toMatch(/z-index\s*:/);
    expect(ruleBody(".board-row")).not.toMatch(/transform\s*:/);
  });

  test("hand zone is pinned to the bottom of the table", () => {
    const css = fs
      .readFileSync(
        path.join(__dirname, "..", "embedded-client", "src", "style.css"),
        "utf8"
      )
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const html = fs.readFileSync(
      path.join(__dirname, "..", "embedded-client", "index.html"),
      "utf8"
    );
    expect(html).toMatch(/class="zone hand-zone" data-zone="hand"/);

    const ruleBody = (selector) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
      expect(match).toBeTruthy();
      return match[1];
    };

    expect(ruleBody("#app.connected")).toMatch(
      /grid-template-rows:\s*minmax\(0,\s*1fr\)/
    );
    expect(ruleBody("#table")).toMatch(/display:\s*flex/);
    expect(ruleBody("#table")).toMatch(/flex-direction:\s*column/);
    expect(ruleBody("#table")).toMatch(/height:\s*100%/);
    expect(ruleBody("#table")).toMatch(/box-sizing:\s*border-box/);
    expect(ruleBody("#table")).not.toMatch(/container-type:/);
    expect(ruleBody("#table")).not.toMatch(/align-content:\s*start/);
    expect(ruleBody("#table > *")).toMatch(/flex-shrink:\s*0/);
    expect(ruleBody(".hand-zone")).toMatch(/flex-shrink:\s*0/);
    expect(ruleBody(".hand-zone")).toMatch(/margin-top:\s*auto/);
    expect(ruleBody(".hand-zone")).not.toMatch(/z-index\s*:/);
    expect(ruleBody(".hand-zone")).not.toMatch(/transform\s*:/);
    expect(css).toMatch(
      /@media\s*\(max-width:\s*820px\)\s*\{[^}]*#app\.connected\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/
    );
  });

  test("visual-mode cards rest at the previous hover-zoom size", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "..", "embedded-client", "src", "style.css"),
      "utf8"
    );
    const previousWidthRem = 5.4;
    const previousHeightRem = 7.55;
    const previousOverlapRem = 2.35;
    const hoverScale = 1.48;

    expect(previousWidthRem * hoverScale).toBeCloseTo(7.992, 3);
    expect(previousHeightRem * hoverScale).toBeCloseTo(11.174, 3);
    expect(previousOverlapRem * hoverScale).toBeCloseTo(3.478, 3);
    expect(css).toContain("--card-width: 7.992rem");
    expect(css).toContain("--card-height: 11.174rem");
    expect(css).toContain("--card-hover-scale: 1.48");
    expect(css).toContain("--hand-overlap: 3.478rem");
    expect(css).toContain("width: var(--card-width)");
    expect(css).toContain("height: var(--card-height)");
    expect(css).toMatch(
      /\.card-tile,\s*\.deck-tile\s*\{[^}]*flex-shrink:\s*0/
    );
    expect(css).not.toContain("--card-used-height");
    expect(css).not.toContain("--card-fit-height");
    expect(css).not.toContain("container-type: size");
    expect(css).not.toContain("max(5.5rem");
    expect(css).toContain("scale(var(--card-hover-scale))");
    expect(css).toContain("margin-left: calc(-1 * var(--hand-overlap))");
    expect(css).toMatch(/#table\s*>\s*\*\s*\{[^}]*flex-shrink:\s*0/);
    expect(css).toMatch(/\.hand-zone\s*\{[^}]*flex-shrink:\s*0/);
    expect(css).not.toMatch(/\.card-tile,\s*\.deck-tile\s*\{[^}]*width:\s*5\.4rem/);
    expect(css).not.toMatch(/\.card-tile,\s*\.deck-tile\s*\{[^}]*height:\s*7\.55rem/);
    expect(css).not.toContain("scale(1.28)");
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
        expect(body).toMatchObject({
          gameName: "Friday Inis",
          channelId: "thread-game",
          guildId: "guild-1",
          hand: [
            { id: "hand-1", name: "Copper" },
            {
              id: "hand-2",
              name: "Gold",
              imageUrl: cardImagePath(
                "https://gamebot.example.com/gold.png",
                deriveImageProxyKey("server-secret")
              ),
            },
          ],
          playArea: [{ id: "play-1", name: "Village" }],
          gameBoard: [{ id: "board-1", name: "Province" }],
          otherPlayers: [
            {
              userId: "other-player",
              name: "other-player",
              handCount: 1,
              avatarUrl: null,
              teamId: "",
              teamName: "",
            },
          ],
        });
        expect(body.decks).toEqual([]);
        expect(body.status.players[0].isYou).toBe(true);
        expect(body.status.players[1].handCount).toBe(1);
        expect(JSON.stringify(body)).not.toContain("Other Player Secret");
        expect(JSON.stringify(body)).not.toContain("Draft Only");
        expect(JSON.stringify(body)).not.toContain('"url"');
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
        expect(typeof body.version).toBe("string");
        expect(body.version.length).toBeGreaterThan(0);
        expect(snapshot.headers.get("etag")).toBe(`"${body.version}"`);
        expect(snapshot.headers.get("cache-control")).toBe("no-store");

        const cached = await fetch(
          `${url}/api/game/snapshot?guildId=guild-1&channelId=thread-game`,
          {
            headers: {
              Authorization: `Bearer ${SECRET_TOKEN}`,
              "If-None-Match": snapshot.headers.get("etag"),
            },
          }
        );
        expect(cached.status).toBe(304);
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

describe("GET /api/game/version", () => {
  async function withStore(run) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-ver-"));
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

  test("is a cheap version check that 304s until the game document changes", async () => {
    await withStore(async (store) => {
      const game = {
        isdeleted: false,
        name: "Friday Inis",
        players: [{ userId: "snowflake-user", hands: { main: [] } }],
        gameBoard: [{ id: "board-1", name: "Province" }],
      };
      store.upsertGameData("guild-1", GAME_COLLECTION, "thread-game", game);
      const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-ver-http-"));
      fs.writeFileSync(
        path.join(staticDir, "index.html"),
        `<!doctype html><html><head></head><body></body></html>`
      );
      const fetchCalls = [];
      const app = createEmbeddedApp({
        clientId: "client-123",
        clientSecret: "server-secret",
        staticDir,
        gameStore: store,
        fetchImpl: mockDiscordFetch({
          calls: fetchCalls,
          meBody: {
            id: "snowflake-user",
            username: "willsullivan",
            global_name: "Will",
          },
        }),
      });
      const { server, url } = await listen(app);
      const auth = { Authorization: `Bearer ${SECRET_TOKEN}` };
      try {
        expect(
          (await fetch(`${url}/api/game/version?guildId=guild-1&channelId=thread-game`))
            .status
        ).toBe(401);

        const first = await fetch(
          `${url}/api/game/version?guildId=guild-1&channelId=thread-game`,
          { headers: auth }
        );
        expect(first.status).toBe(200);
        const firstBody = await first.json();
        expect(firstBody.version).toEqual(expect.any(String));
        expect(first.headers.get("etag")).toBe(`"${firstBody.version}"`);
        expect(first.headers.get("cache-control")).toBe("no-store");
        const meCallsAfterFirst = fetchCalls.filter(
          (call) => call.url === DISCORD_ME_URL
        ).length;
        expect(meCallsAfterFirst).toBe(1);
        expect(DISCORD_USER_CACHE_TTL_MS).toBe(45_000);

        const cached = await fetch(
          `${url}/.proxy/api/game/version?guildId=guild-1&channelId=thread-game`,
          { headers: { ...auth, "If-None-Match": first.headers.get("etag") } }
        );
        expect(cached.status).toBe(304);
        expect(
          fetchCalls.filter((call) => call.url === DISCORD_ME_URL).length
        ).toBe(meCallsAfterFirst);

        const again = await fetch(
          `${url}/api/game/version?guildId=guild-1&channelId=thread-game`,
          { headers: auth }
        );
        expect(again.status).toBe(200);
        expect(
          fetchCalls.filter((call) => call.url === DISCORD_ME_URL)
        ).toHaveLength(1);

        game.gameBoard.push({ id: "board-2", name: "Duchy" });
        store.upsertGameData("guild-1", GAME_COLLECTION, "thread-game", game);

        const changed = await fetch(
          `${url}/api/game/version?guildId=guild-1&channelId=thread-game`,
          { headers: { ...auth, "If-None-Match": first.headers.get("etag") } }
        );
        expect(changed.status).toBe(200);
        const changedBody = await changed.json();
        expect(changedBody.version).not.toBe(firstBody.version);
        expect(
          fetchCalls.filter((call) => call.url === DISCORD_ME_URL).length
        ).toBe(meCallsAfterFirst);
      } finally {
        server.close();
        fs.rmSync(staticDir, { recursive: true, force: true });
      }
    });
  });

  test("version and snapshot deny a non-member before leaking no_game vs not_a_player", async () => {
    await withStore(async (store) => {
      store.upsertGameData("guild-1", GAME_COLLECTION, "thread-game", {
        isdeleted: false,
        name: "Friday Inis",
        players: [{ userId: "snowflake-user", hands: { main: [] } }],
      });
      const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-ver-auth-"));
      fs.writeFileSync(
        path.join(staticDir, "index.html"),
        `<!doctype html><html><head></head><body></body></html>`
      );
      const fetchImpl = async (url) => {
        if (String(url) === DISCORD_ME_URL) {
          return jsonResponse(200, {
            id: "outsider",
            username: "visitor",
            global_name: "Visitor",
          });
        }
        if (
          String(url) === `${DISCORD_API_BASE}/guilds/guild-1/members/outsider`
        ) {
          return { status: 404, ok: false, json: async () => ({ message: "Unknown Member" }) };
        }
        if (String(url).startsWith(`${DISCORD_API_BASE}/channels/`)) {
          return jsonResponse(200, { id: "thread-game" });
        }
        throw new Error(`unexpected fetch ${url}`);
      };
      const app = createEmbeddedApp({
        clientId: "client-123",
        clientSecret: "server-secret",
        staticDir,
        gameStore: store,
        botToken: "bot-token",
        fetchImpl,
      });
      const { server, url } = await listen(app);
      const auth = { Authorization: `Bearer ${SECRET_TOKEN}` };
      const qs = "guildId=guild-1&channelId=thread-game";
      const missingQs = "guildId=guild-1&channelId=no-such-thread";
      try {
        const versionHit = await fetch(`${url}/api/game/version?${qs}`, {
          headers: auth,
        });
        const snapshotHit = await fetch(`${url}/api/game/snapshot?${qs}`, {
          headers: auth,
        });
        const versionMiss = await fetch(`${url}/api/game/version?${missingQs}`, {
          headers: auth,
        });
        const snapshotMiss = await fetch(`${url}/api/game/snapshot?${missingQs}`, {
          headers: auth,
        });
        expect(await versionHit.json()).toEqual({ error: "not_a_player" });
        expect(await snapshotHit.json()).toEqual({ error: "not_a_player" });
        expect(await versionMiss.json()).toEqual({ error: "not_a_player" });
        expect(await snapshotMiss.json()).toEqual({ error: "not_a_player" });
        expect(versionHit.status).toBe(403);
        expect(snapshotHit.status).toBe(403);
        expect(versionMiss.status).toBe(403);
        expect(snapshotMiss.status).toBe(403);
      } finally {
        server.close();
        fs.rmSync(staticDir, { recursive: true, force: true });
      }
    });
  });

  test("guild non-member gets 403 without revealing whether a game exists", async () => {
    await withStore(async (store) => {
      store.upsertGameData("guild-1", GAME_COLLECTION, "thread-game", {
        isdeleted: false,
        name: "Friday Inis",
        players: [{ userId: "someone-else", hands: { main: [] } }],
        gameBoard: [{ id: "board-1", name: "Province" }],
      });
      const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-ver-403-"));
      fs.writeFileSync(
        path.join(staticDir, "index.html"),
        `<!doctype html><html><head></head><body></body></html>`
      );
      const app = createEmbeddedApp({
        clientId: "client-123",
        clientSecret: "server-secret",
        staticDir,
        gameStore: store,
        botToken: "bot-token",
        fetchImpl: async (url) => {
          if (String(url) === DISCORD_ME_URL) {
            return jsonResponse(200, {
              id: "snowflake-user",
              username: "willsullivan",
              global_name: "Will",
            });
          }
          if (
            String(url) ===
            `${DISCORD_API_BASE}/guilds/guild-1/members/snowflake-user`
          ) {
            return jsonResponse(404, { message: "Unknown Member" });
          }
          throw new Error(`unexpected fetch ${url}`);
        },
      });
      const { server, url } = await listen(app);
      try {
        const response = await fetch(
          `${url}/api/game/version?guildId=guild-1&channelId=missing-thread`,
          { headers: { Authorization: `Bearer ${SECRET_TOKEN}` } }
        );
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: "not_a_player" });
      } finally {
        server.close();
        fs.rmSync(staticDir, { recursive: true, force: true });
      }
    });
  });
});

describe("POST /api/game/action", () => {
  const Formatter = require("../modules/GameFormatter");
  const { withDiscordAccess } = require("./helpers/discordAccess");
  const originalCreateGameStatusReply = Formatter.createGameStatusReply;

  function actionGame({
    userId = "snowflake-user",
    draw = [
      { id: "d1", name: "Ace", url: null },
      { id: "d2", name: "King", url: null },
      { id: "d3", name: "Queen", url: null },
      { id: "d4", name: "Jack", url: null },
    ],
  } = {}) {
    return {
      isdeleted: false,
      name: "Friday Inis",
      players: [
        {
          userId,
          name: "Will",
          order: 0,
          hands: { main: [{ id: "hand-1", name: "Copper", url: null }] },
        },
        {
          userId: "other-player",
          name: "Riley",
          order: 1,
          hands: { main: [] },
        },
      ],
      decks: [
        {
          name: "Main",
          piles: {
            draw: { cards: draw },
            discard: { cards: [] },
          },
        },
      ],
      history: [],
    };
  }

  async function withStore(run) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-action-"));
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

  async function withActionApp(
    {
      game = actionGame(),
      send,
      botToken = "bot-token",
      access = {},
      meBody,
      clientExtras = {},
      saveDelayMs = 0,
    } = {},
    run
  ) {
    Formatter.createGameStatusReply = async (_gameData, _guild, _clientUserId, options = {}) => ({
      content: options.content ?? "📊",
      embeds: [],
      files: [],
    });
    try {
      await withStore(async (store) => {
        store.upsertGameData("guild-1", GAME_COLLECTION, "thread-game", game);
        const posted = [];
        const channel = {
          id: "thread-game",
          guild: { id: "guild-1" },
          messages: { fetch: async () => null },
          send: async (payload) => {
            if (typeof send === "function") return send(payload, posted);
            posted.push(payload);
            return { id: `msg-${posted.length}` };
          },
        };
        const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-action-http-"));
        fs.writeFileSync(
          path.join(staticDir, "index.html"),
          `<!doctype html><html><head></head><body></body></html>`
        );
        const userId = meBody?.id || "snowflake-user";
        const app = createEmbeddedApp({
          clientId: "client-123",
          clientSecret: "server-secret",
          staticDir,
          gameStore: store,
          botToken,
          discordClient: {
            user: { id: "bot-1" },
            channels: {
              cache: { get: (id) => (id === "thread-game" ? channel : null) },
            },
            getGameDataV2: async (guildId, collection, channelId) =>
              store.getSpecificGameData(guildId, collection, channelId),
            setGameDataV2: async (guildId, collection, channelId, data) => {
              if (saveDelayMs) {
                await new Promise((resolve) => setTimeout(resolve, saveDelayMs));
              }
              store.upsertGameData(guildId, collection, channelId, data);
            },
            ...clientExtras,
          },
          fetchImpl: withDiscordAccess(
            mockDiscordFetch({
              meBody: meBody || {
                id: userId,
                username: "willsullivan",
                global_name: "Will",
              },
            }),
            {
              guildId: "guild-1",
              channelId: "thread-game",
              userId,
              ...access,
            }
          ),
        });
        const { server, url } = await listen(app);
        try {
          await run({ url, posted, store });
        } finally {
          await drainLockedVisualActions();
          server.close();
          fs.rmSync(staticDir, { recursive: true, force: true });
        }
      });
    } finally {
      Formatter.createGameStatusReply = originalCreateGameStatusReply;
    }
  }

  function postAction(url, body) {
    return fetch(`${url}/api/game/action`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SECRET_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        guildId: "guild-1",
        channelId: "thread-game",
        ...body,
      }),
    });
  }

  async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 5 } = {}) {
    const start = Date.now();
    while (!predicate()) {
      if (Date.now() - start > timeoutMs) {
        throw new Error("timed out waiting");
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  test("draw updates the snapshot hand and history and posts to the game channel", async () => {
    await withActionApp({}, async ({ url, posted }) => {
      const missingAuth = await fetch(`${url}/api/game/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "draw",
          deck: "Main",
          count: 2,
          guildId: "guild-1",
          channelId: "thread-game",
        }),
      });
      expect(missingAuth.status).toBe(401);

      const drawn = await postAction(url, { action: "draw", deck: "Main", count: 2 });
      expect(drawn.status).toBe(200);
      const body = await drawn.json();
      expect(body.message).toBe("TableWill drew 2 cards from Main");
      expect(body.channelPosted).toBeUndefined();
      expect(body.hand.map((card) => card.name)).toEqual(["Copper", "Ace", "King"]);
      expect(body.status.history.at(-1).summary).toBe("TableWill drew 2 cards from Main");
      await waitFor(() => posted.length === 1);
      expect(posted[0].content).toContain("TableWill drew 2 cards from Main");

      const snapshot = await fetch(
        `${url}/api/game/snapshot?guildId=guild-1&channelId=thread-game`,
        { headers: { Authorization: `Bearer ${SECRET_TOKEN}` } }
      );
      expect((await snapshot.json()).hand.map((card) => card.name)).toEqual([
        "Copper",
        "Ace",
        "King",
      ]);
    });
  });

  test("deal 200 deals to each player and posts", async () => {
    await withActionApp({}, async ({ url, posted }) => {
      const dealt = await postAction(url, { action: "deal", deck: "Main", count: 1 });
      expect(dealt.status).toBe(200);
      const body = await dealt.json();
      expect(body.message).toBe("Dealt out a total of 2 cards from Main.");
      expect(body.channelPosted).toBeUndefined();
      expect(body.hand.map((card) => card.name)).toEqual(["Copper", "Ace"]);
      await waitFor(() => posted.length === 1);
      expect(posted[0].content).toContain("Dealt out a total of 2 cards from Main.");
    });
  });

  test("403 not_a_guild_member when the user is not a guild member", async () => {
    await withActionApp({ access: { memberStatus: 404 } }, async ({ url }) => {
      const res = await postAction(url, { action: "draw", deck: "Main", count: 1 });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({
        error: "not_a_guild_member",
        message: "You're not a member of this server.",
      });
    });
  });

  test("bad count is 400 with a friendly message", async () => {
    await withActionApp({}, async ({ url }) => {
      const res = await postAction(url, { action: "draw", deck: "Main", count: 0 });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        error: "invalid_count",
        message: expect.stringContaining("whole number"),
      });
    });
  });

  test("empty deck is 409", async () => {
    await withActionApp({ game: actionGame({ draw: [] }) }, async ({ url }) => {
      const res = await postAction(url, { action: "draw", deck: "Main", count: 1 });
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        error: "no_cards_in_draw",
        message: "No cards in draw pile",
      });
    });
  });

  test("guard deny when the member cannot view the channel", async () => {
    const { PermissionFlagsBits } = require("discord.js");
    await withActionApp(
      {
        access: {
          overwrites: [
            {
              id: "snowflake-user",
              deny: String(PermissionFlagsBits.ViewChannel),
              allow: "0",
            },
          ],
        },
      },
      async ({ url }) => {
        const res = await postAction(url, { action: "deal", deck: "Main", count: 1 });
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ error: "forbidden" });
      }
    );
  });

  test("no bot token fails closed", async () => {
    await withActionApp({ botToken: "" }, async ({ url }) => {
      const res = await postAction(url, { action: "deal", deck: "Main", count: 1 });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: "access_unverified" });
    });
  });

  test("Discord 429 fails closed with try_again", async () => {
    await withActionApp({ access: { memberStatus: 429 } }, async ({ url }) => {
      const res = await postAction(url, { action: "deal", deck: "Main", count: 1 });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({
        error: "try_again",
        message: expect.stringContaining("Try again"),
      });
    });
  });

  test("cross-guild channel mismatch is 403", async () => {
    await withActionApp({ access: { channelGuildId: "other-guild" } }, async ({ url }) => {
      const res = await postAction(url, { action: "deal", deck: "Main", count: 1 });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: "channel_mismatch" });
    });
  });

  test("cross-guild document key does not mutate the real game", async () => {
    await withActionApp({ access: { guildId: "guild-2" } }, async ({ url, store }) => {
      const res = await fetch(`${url}/api/game/action`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SECRET_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "deal",
          deck: "Main",
          count: 1,
          guildId: "guild-2",
          channelId: "thread-game",
        }),
      });
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: "no_game" });
      const saved = store.getSpecificGameData("guild-1", GAME_COLLECTION, "thread-game");
      expect(saved.players[0].hands.main).toHaveLength(1);
    });
  });

  function cardNames(cards) {
    return (cards || []).map((card) => card.name);
  }

  function allCardIds(game) {
    const ids = [];
    for (const player of game.players || []) {
      for (const card of player.hands?.main || []) ids.push(card.id);
    }
    for (const deck of game.decks || []) {
      for (const pile of Object.values(deck.piles || {})) {
        for (const card of pile.cards || []) ids.push(card.id);
      }
    }
    return ids;
  }

  function postMatchesHistory(content, entry) {
    if (entry?.action?.type === GameDB.ACTION_TYPES.DRAW) {
      return String(content || "").includes(entry.summary);
    }
    if (entry?.action?.type === GameDB.ACTION_TYPES.DEAL) {
      return String(content || "").includes("Dealt out a total of");
    }
    return false;
  }

  function raceClient() {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    return {
      saveDelayMs: 20,
      clientExtras: {
        guilds: {
          cache: { get: () => null },
          fetch: async () => ({
            members: {
              cache: { get: () => null },
              fetch: async (userId) => {
                await delay(150);
                return {
                  displayName: userId === "snowflake-user" ? "WillOnServer" : "Riley",
                };
              },
            },
          }),
        },
      },
    };
  }

  test("concurrent Draw POSTs with a slow nick lookup each persist a different card", async () => {
    await withActionApp(raceClient(), async ({ url, posted, store }) => {
      const [firstRes, secondRes] = await Promise.all([
        postAction(url, {
          action: "draw",
          deck: "Main",
          count: 1,
          requestId: "http-race-aaa",
        }),
        postAction(url, {
          action: "draw",
          deck: "Main",
          count: 1,
          requestId: "http-race-bbb",
        }),
      ]);
      expect(firstRes.status).toBe(200);
      expect(secondRes.status).toBe(200);
      const first = await firstRes.json();
      const second = await secondRes.json();
      const saved = store.getSpecificGameData("guild-1", GAME_COLLECTION, "thread-game");
      expect(cardNames(saved.players[0].hands.main)).toEqual(["Copper", "Ace", "King"]);
      expect(cardNames(saved.decks[0].piles.draw.cards)).toEqual(["Queen", "Jack"]);
      expect(new Set([first.hand.at(-1).name, second.hand.at(-1).name])).toEqual(
        new Set(["Ace", "King"])
      );
      const ids = allCardIds(saved);
      expect(new Set(ids).size).toBe(ids.length);
      const drawHistory = saved.history.filter(
        (entry) => entry?.action?.type === GameDB.ACTION_TYPES.DRAW
      );
      expect(drawHistory.map((entry) => entry.summary)).toEqual([
        "TableWill drew 1 cards from Main",
        "TableWill drew 1 cards from Main",
      ]);
      await waitFor(() => posted.length === drawHistory.length);
      posted.forEach((payload, index) => {
        expect(postMatchesHistory(payload.content, drawHistory[index])).toBe(true);
      });
    });
  });

  test("concurrent Deal and Draw POSTs both apply in order without duplicating a card", async () => {
    await withActionApp(raceClient(), async ({ url, posted, store }) => {
      const [dealRes, drawRes] = await Promise.all([
        postAction(url, {
          action: "deal",
          deck: "Main",
          count: 1,
          requestId: "http-deal-aaa",
        }),
        postAction(url, {
          action: "draw",
          deck: "Main",
          count: 1,
          requestId: "http-draw-bbb",
        }),
      ]);
      expect(dealRes.status).toBe(200);
      expect(drawRes.status).toBe(200);
      const saved = store.getSpecificGameData("guild-1", GAME_COLLECTION, "thread-game");
      const will = cardNames(saved.players[0].hands.main);
      const riley = cardNames(saved.players[1].hands.main);
      const draw = cardNames(saved.decks[0].piles.draw.cards);
      const drawThenDeal =
        will.join() === "Copper,Ace,King" &&
        riley.join() === "Queen" &&
        draw.join() === "Jack";
      const dealThenDraw =
        will.join() === "Copper,Ace,Queen" &&
        riley.join() === "King" &&
        draw.join() === "Jack";
      expect(drawThenDeal || dealThenDraw).toBe(true);
      const ids = allCardIds(saved);
      expect(new Set(ids).size).toBe(ids.length);
      const history = saved.history.filter((entry) =>
        [GameDB.ACTION_TYPES.DEAL, GameDB.ACTION_TYPES.DRAW].includes(entry?.action?.type)
      );
      expect(history.map((entry) => entry.action.type).sort()).toEqual(
        [GameDB.ACTION_TYPES.DEAL, GameDB.ACTION_TYPES.DRAW].sort()
      );
      await waitFor(() => posted.length === history.length);
      const postedContents = posted.map((payload) => payload.content);
      for (const entry of history) {
        expect(
          postedContents.some((content) => postMatchesHistory(content, entry))
        ).toBe(true);
      }
    });
  });

  test("Deal POST returns the table before a slow channel send finishes", async () => {
    let releaseSend;
    const sendGate = new Promise((resolve) => {
      releaseSend = resolve;
    });
    let memberFetches = 0;
    await withActionApp(
      {
        send: async (payload, posted) => {
          await sendGate;
          posted.push(payload);
          return { id: "msg-1" };
        },
        clientExtras: {
          guilds: {
            cache: { get: () => null },
            fetch: async () => {
              memberFetches += 1;
              return {
                members: {
                  cache: { get: () => null },
                  fetch: async () => ({ displayName: "SlowNick" }),
                },
              };
            },
          },
        },
      },
      async ({ url, posted }) => {
        try {
          const res = await postAction(url, { action: "deal", deck: "Main", count: 1 });
          expect(res.status).toBe(200);
          const body = await res.json();
          expect(body.message).toBe("Dealt out a total of 2 cards from Main.");
          expect(body.hand.map((card) => card.name)).toEqual(["Copper", "Ace"]);
          expect(body.channelPosted).toBeUndefined();
          expect(posted).toHaveLength(0);
          expect(memberFetches).toBe(0);
        } finally {
          releaseSend();
        }
        await waitFor(() => posted.length === 1);
        expect(posted[0].content).toContain("Dealt out a total of 2 cards from Main.");
      }
    );
  });
});
