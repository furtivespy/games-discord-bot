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
  ONE_GAME_FIXTURE,
  SEVERAL_GAMES_FIXTURE,
  TEAM_GAME_CHANNEL_ID,
  TEAM_GAME_CHANNEL_NAME,
  TEAM_GAME_FIXTURE,
  getMockGames,
  getMockSnapshot,
  hostImagesSeed,
  isEmbeddedAppMockEnabled,
  MOCK_HOST_BOARD_IMAGES,
  otherPlayerHand,
  populatedSeed,
  snapshotFromSeed,
  teamGameSeed,
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
      "hand-4",
      "hand-5",
    ]);
    expect(result.body.playArea.map((card) => card.name)).toEqual([
      "Village",
      "Market",
    ]);
    expect(result.body.playArea[0].description).toBe("Worth 1 action. Draw a card.");
    expect(result.body.gameBoard.map((card) => card.name)).toEqual([
      "Province",
      "Duchy",
      "Estate",
    ]);
    expect(result.body.players).toBeUndefined();
    expect(result.body.otherPlayers.map((player) => [player.name, player.isYou, player.order])).toEqual([
      ["QA Tester", true, 0],
      ["Riley", false, 1],
      ["Sam", false, 2],
    ]);
    expect(result.body.otherPlayers[1].handCount).toBe(1);
    expect(result.body.otherPlayers[2].handCount).toBe(4);
    expect(result.body.decks.map((deck) => deck.name)).toEqual([
      "Main",
      "Events",
      "Unused Chaos Deck",
    ]);
    expect(result.body.decks[0]).toEqual({
      name: "Main",
      remaining: 30,
      total: 42,
      discard: 4,
    });
    expect(result.body.decks[1]).toEqual({
      name: "Events",
      remaining: 8,
      total: 15,
      discard: 1,
    });
    expect(result.body.decks[2]).toEqual({
      name: "Unused Chaos Deck",
      remaining: 12,
      total: 20,
      discard: 0,
    });
    expect(JSON.stringify(result.body)).not.toContain("Unused Chaos 1");
    expect(JSON.stringify(result.body)).not.toContain("Discarded Copper");
    expect(result.body.status.players[0].isYou).toBe(true);
    expect(result.body.status.players[0].tokens.clue).toBe(2);
    expect(result.body.status.players[1].tokens.clue).toBe("?");
    expect(result.body.status.teams).toEqual([]);
    expect(result.body.otherPlayers.every((player) => player.teamName === "")).toBe(true);
  });

  test("team-game fixture has six players on 🦀🦀 vs 💪🐟", () => {
    const result = getMockSnapshot({ fixture: "team-game" });
    expect(result.status).toBe(200);
    expect(result.body.gameName).toBe(TEAM_GAME_CHANNEL_NAME);
    expect(result.body.status.teams.map((team) => team.name)).toEqual(["🦀🦀", "💪🐟"]);
    expect(result.body.status.players).toHaveLength(6);
    expect(result.body.status.players[0]).toMatchObject({
      name: "QA Tester",
      isYou: true,
      teamName: "🦀🦀",
    });
    expect(result.body.otherPlayers.map((player) => [player.name, player.teamId, player.teamName, player.isYou])).toEqual([
      ["QA Tester", "team-crab", "🦀🦀", true],
      ["Riley", "team-crab", "🦀🦀", false],
      ["Sam", "team-crab", "🦀🦀", false],
      ["Alex", "team-fish", "💪🐟", false],
      ["Jordan", "team-fish", "💪🐟", false],
      ["Casey", "team-fish", "💪🐟", false],
    ]);
    expect(JSON.stringify(result.body)).not.toContain("Alex Secret");
    expect(JSON.stringify(result.body)).not.toContain("Jordan Secret");
    expect(teamGameSeed().players).toHaveLength(6);
  });

  test("host-images fixture puts the host's latest photos on an empty board", () => {
    const result = getMockSnapshot({ fixture: "host-images" });
    expect(result.status).toBe(200);
    expect(hostImagesSeed().gameBoard).toEqual([]);
    expect(result.body.gameBoard).toEqual(
      MOCK_HOST_BOARD_IMAGES.map((card) => ({ ...card }))
    );
    expect(result.body.gameBoard.map((card) => card.imageUrl)).toEqual([
      "/mock-host-setup.svg",
      "/mock-host-reference.svg",
    ]);
    expect(result.body.hand).toHaveLength(5);
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
    expect(json).not.toContain("Other Play Area");
    expect(json).not.toContain("Draft Only");
    expect(json).not.toContain("Simultaneous Only");
    expect(json).not.toContain("Sam Secret");
    expect(json).not.toContain(MOCK_ACCESS_TOKEN);
    expect(snapshot.hand.some((card) => card.id === "draft-1")).toBe(false);
    expect(snapshot.otherPlayers.some((player) => player.userId === "other-player-2")).toBe(
      true
    );
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

  test("picker fixtures load the populated table for the selected channel id", () => {
    const selected = getMockSnapshot({
      fixture: "several-games",
      channelId: "newest-thread",
      guildId: "mock-guild",
    });
    expect(selected.status).toBe(200);
    expect(selected.body.channelId).toBe("newest-thread");
    expect(selected.body.hand).toHaveLength(5);
    expect(
      getMockSnapshot({ fixture: "one-game", channelId: "solo-thread" }).body
        .channelId
    ).toBe("solo-thread");
    expect(getMockSnapshot({ fixture: "no-games" })).toEqual({
      status: 404,
      body: { error: "no_game" },
    });
  });
});

describe("mock game list fixtures", () => {
  test("several-games is newest first; default and populated alias that list", () => {
    const several = getMockGames({ fixture: "several-games" });
    expect(several.status).toBe(200);
    expect(several.body.games.map((game) => game.channelName)).toEqual([
      "Friday Inis",
      "Thursday Root",
      "Monday Poker",
    ]);
    expect(several.body.games[0]).toEqual(SEVERAL_GAMES_FIXTURE[0]);
    expect(JSON.stringify(several.body)).not.toMatch(/hand|playArea|gameBoard|isdeleted/);
    expect(getMockGames({})).toEqual(several);
    expect(getMockGames({ fixture: "populated" })).toEqual(several);
    expect(getMockGames({ fixture: "" })).toEqual(several);
  });

  test("one-game and no-games cover the other picker states", () => {
    expect(getMockGames({ fixture: "one-game" })).toEqual({
      status: 200,
      body: { games: [...ONE_GAME_FIXTURE] },
    });
    expect(getMockGames({ fixture: "no-games" })).toEqual({
      status: 200,
      body: { games: [] },
    });
    expect(getMockGames({ fixture: "no-game" })).toEqual({
      status: 200,
      body: { games: [] },
    });
    expect(getMockGames({ fixture: "not-a-player" })).toEqual({
      status: 200,
      body: { games: [] },
    });
    expect(getMockGames({ fixture: "unknown-list" })).toEqual({
      status: 400,
      body: { error: "unknown_fixture" },
    });
    expect(getMockGames({ fixture: "team-game" })).toEqual({
      status: 200,
      body: { games: [...TEAM_GAME_FIXTURE] },
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

  test("GET /api/games serves picker fixtures without talking to Discord", async () => {
    const staticDir = makeStaticDir();
    const fetchCalls = [];
    const app = createEmbeddedApp({
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
      const unauthorized = await fetch(`${url}/api/games?fixture=several-games`);
      expect(unauthorized.status).toBe(401);

      const several = await fetch(`${url}/api/games?fixture=several-games`, {
        headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
      });
      expect(several.status).toBe(200);
      expect((await several.json()).games.map((game) => game.channelName)).toEqual(
        ["Friday Inis", "Thursday Root", "Monday Poker"]
      );

      const teamList = await fetch(`${url}/api/games?fixture=team-game`, {
        headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
      });
      expect(teamList.status).toBe(200);
      expect(await teamList.json()).toEqual({
        games: [{ channelId: TEAM_GAME_CHANNEL_ID, channelName: TEAM_GAME_CHANNEL_NAME }],
      });

      const one = await fetch(`${url}/.proxy/api/games?fixture=one-game`, {
        headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
      });
      expect(one.status).toBe(200);
      expect(await one.json()).toEqual({
        games: [{ channelId: "solo-thread", channelName: "Solo Table" }],
      });

      const none = await fetch(`${url}/api/games?fixture=no-games`, {
        headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
      });
      expect(none.status).toBe(200);
      expect(await none.json()).toEqual({ games: [] });

      const omitted = await fetch(`${url}/api/games`, {
        headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
      });
      expect(omitted.status).toBe(200);
      expect((await omitted.json()).games.map((game) => game.channelName)).toEqual(
        ["Friday Inis", "Thursday Root", "Monday Poker"]
      );

      const noGame = await fetch(`${url}/api/games?fixture=no-game`, {
        headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
      });
      expect(noGame.status).toBe(200);
      expect(await noGame.json()).toEqual({ games: [] });
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
    const auth = { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` };

    try {
      const unauthorized = await fetch(`${url}/api/game/snapshot`);
      expect(unauthorized.status).toBe(401);

      const populated = await fetch(`${url}/api/game/snapshot`, {
        headers: auth,
      });
      expect(populated.status).toBe(200);
      const body = await populated.json();
      expect(body.channelId).toBe("table-9");
      expect(body.guildId).toBe("guild-9");
      expect(body.hand).toHaveLength(5);
      expect(JSON.stringify(body)).not.toContain("Other Player Secret");

      const hostImages = await fetch(`${url}/api/game/snapshot?fixture=host-images`, {
        headers: auth,
      });
      expect(hostImages.status).toBe(200);
      expect((await hostImages.json()).gameBoard.map((card) => card.name)).toEqual([
        "Table setup",
        "Reference",
      ]);

      const noGame = await fetch(`${url}/api/game/snapshot?fixture=no-game`, {
        headers: auth,
      });
      expect(noGame.status).toBe(404);
      expect(await noGame.json()).toEqual({ error: "no_game" });

      const notPlayer = await fetch(
        `${url}/.proxy/api/game/snapshot?fixture=not-a-player`,
        { headers: auth }
      );
      expect(notPlayer.status).toBe(403);
      expect(await notPlayer.json()).toEqual({ error: "not_a_player" });

      const override = await fetch(
        `${url}/api/game/snapshot?channelId=newest-thread&guildId=g-query&fixture=several-games`,
        { headers: auth }
      );
      expect(await override.json()).toMatchObject({
        channelId: "newest-thread",
        guildId: "g-query",
        gameName: "Fixture Game",
      });

      const teamGame = await fetch(
        `${url}/api/game/snapshot?fixture=team-game&channelId=${TEAM_GAME_CHANNEL_ID}`,
        { headers: auth }
      );
      expect(await teamGame.json()).toMatchObject({
        channelId: TEAM_GAME_CHANNEL_ID,
        gameName: TEAM_GAME_CHANNEL_NAME,
      });

      expect(typeof body.version).toBe("string");
      const versionRes = await fetch(`${url}/api/game/version`, { headers: auth });
      expect(versionRes.status).toBe(200);
      expect(await versionRes.json()).toEqual({ version: body.version });
      const cached = await fetch(`${url}/.proxy/api/game/version`, {
        headers: { ...auth, "If-None-Match": versionRes.headers.get("etag") },
      });
      expect(cached.status).toBe(304);
    } finally {
      server.close();
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  test("POST /api/game/action deals and draws against the mock table and keeps the snapshot", async () => {
    const staticDir = makeStaticDir();
    const app = createEmbeddedApp({
      mock: true,
      mockChannelId: "newest-thread",
      mockGuildId: "mock-guild",
      env: DEV_ENV,
      staticDir,
    });
    const { server, url } = await listen(app);
    const auth = {
      Authorization: `Bearer ${MOCK_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    };

    try {
      const before = await fetch(
        `${url}/api/game/snapshot?fixture=several-games&channelId=newest-thread&guildId=mock-guild`,
        { headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` } }
      );
      const beforeBody = await before.json();
      const handBefore = beforeBody.hand.length;
      const remainingBefore = Number(beforeBody.decks[0].remaining);
      const versionBefore = beforeBody.version;

      const unauthorized = await fetch(`${url}/api/game/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "draw",
          deck: "Main",
          count: 2,
          channelId: "newest-thread",
          guildId: "mock-guild",
          fixture: "several-games",
        }),
      });
      expect(unauthorized.status).toBe(401);

      const drawn = await fetch(`${url}/api/game/action`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          action: "draw",
          deck: "Main",
          count: 2,
          channelId: "newest-thread",
          guildId: "mock-guild",
          fixture: "several-games",
        }),
      });
      expect(drawn.status).toBe(200);
      const drawnBody = await drawn.json();
      expect(drawnBody.hand).toHaveLength(handBefore + 2);
      expect(drawnBody.channelPosted).toBe(true);
      expect(drawnBody.status.history.at(-1).summary).toContain("drew 2 cards from Main");
      expect(Number(drawnBody.decks[0].remaining)).toBe(remainingBefore - 2);
      expect(drawnBody.version).not.toBe(versionBefore);
      const versionAfterDraw = await fetch(
        `${url}/api/game/version?fixture=several-games&channelId=newest-thread&guildId=mock-guild`,
        { headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` } }
      );
      expect(await versionAfterDraw.json()).toEqual({ version: drawnBody.version });

      const snapshot = await fetch(
        `${url}/api/game/snapshot?fixture=several-games&channelId=newest-thread&guildId=mock-guild`,
        { headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` } }
      );
      expect((await snapshot.json()).hand).toHaveLength(handBefore + 2);

      const dealt = await fetch(`${url}/.proxy/api/game/action`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          action: "deal",
          deck: "Main",
          count: 1,
          channelId: "newest-thread",
          guildId: "mock-guild",
          fixture: "several-games",
        }),
      });
      expect(dealt.status).toBe(200);
      const dealtBody = await dealt.json();
      expect(dealtBody.message).toContain("Dealt out a total of");
      expect(dealtBody.status.history.at(-1).summary).toContain("dealt");

      const scored = await fetch(`${url}/api/game/action`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          action: "scores",
          scores: { [MOCK_USER.id]: "99", "other-player-2": "1" },
          channelId: "newest-thread",
          guildId: "mock-guild",
          fixture: "several-games",
        }),
      });
      expect(scored.status).toBe(200);
      const scoredBody = await scored.json();
      expect(scoredBody.message).toBe("Player scores updated successfully.");
      const will = scoredBody.status.players.find(
        (player) => player.userId === MOCK_USER.id
      );
      const riley = scoredBody.status.players.find(
        (player) => player.userId === "other-player-2"
      );
      expect(will.score).toBe("99");
      expect(riley.score).toBe("1");
      const played = await fetch(`${url}/api/game/action`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          action: "play",
          cardId: "hand-1",
          channelId: "newest-thread",
          guildId: "mock-guild",
          fixture: "several-games",
        }),
      });
      expect(played.status).toBe(200);
      const playedBody = await played.json();
      expect(playedBody.message).toContain("has Played to");
      expect(playedBody.hand.some((card) => card.id === "hand-1")).toBe(false);

      const shown = await fetch(`${url}/api/game/action`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          action: "show",
          cardId: "hand-2",
          channelId: "newest-thread",
          guildId: "mock-guild",
          fixture: "several-games",
        }),
      });
      expect(shown.status).toBe(200);
      const shownBody = await shown.json();
      expect(shownBody.message).toBe("Showing a card:");
      expect(shownBody.hand.some((card) => card.id === "hand-2")).toBe(true);

      const discarded = await fetch(`${url}/api/game/action`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          action: "discard",
          cardId: "hand-2",
          channelId: "newest-thread",
          guildId: "mock-guild",
          fixture: "several-games",
        }),
      });
      expect(discarded.status).toBe(200);
      const discardedBody = await discarded.json();
      expect(discardedBody.message).toContain("has Discarded a card");
      expect(discardedBody.hand.some((card) => card.id === "hand-2")).toBe(false);

      expect(scoredBody.status.history.at(-1).summary).toContain(
        "updated player scores"
      );
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
      expect(snapshot.status).toBe(401);
      expect(await snapshot.json()).toEqual({ error: "unauthorized" });

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
      expect(snapshot.status).toBe(401);

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
