const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const GameStore = require("../db/gameStore");
const GameDB = require("../db/anygame");
const {
  DISCORD_API_BASE,
  GAME_COLLECTION,
  HISTORY_KEEP_LIMIT,
  createdAtMs,
  discordSnowflakeMs,
  filterAndSortActiveGames,
  isActivePlayerGame,
  listActiveGamesForUser,
  createDiscordLookupCache,
  memberChannelPermissions,
  optionalDiscordAccessGuard,
  requiredDiscordAccessGuard,
  MAX_VISIBLE_DECKS,
  snapshotFromGameData,
  snapshotGameForUser,
  snapshotVersion,
  formatEtag,
  etagMatches,
  userIsPlayer,
  versionGameForUser,
} = require("../modules/embeddedGames");

async function withStore(run) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-games-"));
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

function historyEntry(category, type, timestamp) {
  return {
    timestamp,
    action: { category, type },
  };
}

function gameCreate(timestamp) {
  return historyEntry(
    GameDB.ACTION_CATEGORIES.GAME,
    GameDB.ACTION_TYPES.CREATE,
    timestamp
  );
}

describe("active game membership", () => {
  test("requires isdeleted not true and the opening user in players by userId", () => {
    const userId = "player-1";
    expect(
      isActivePlayerGame(
        {
          isdeleted: false,
          players: [{ userId }],
        },
        userId
      )
    ).toBe(true);
    expect(
      isActivePlayerGame(
        {
          isdeleted: true,
          players: [{ userId }],
        },
        userId
      )
    ).toBe(false);
    expect(
      isActivePlayerGame(
        {
          isdeleted: false,
          players: [{ userId: "someone-else" }],
        },
        userId
      )
    ).toBe(false);
    expect(userIsPlayer({ players: [{ userId: 123 }] }, "123")).toBe(true);
  });
});

describe("createdAtMs", () => {
  test("uses the earliest GAME CREATE, not array order or later activity", () => {
    const ms = createdAtMs({
      channelId: "111111111111111111",
      updatedAt: "2026-11-11 23:00:00",
      data: {
        history: [
          historyEntry(
            GameDB.ACTION_CATEGORIES.CARD,
            GameDB.ACTION_TYPES.PLAY,
            "2026-11-11T20:00:00.000Z"
          ),
          gameCreate("2026-10-01T12:00:00.000Z"),
        ],
      },
    });
    expect(ms).toBe(Date.parse("2026-10-01T12:00:00.000Z"));
  });

  test("falls back to earliest history only when the log is not truncated", () => {
    const fromHistory = createdAtMs({
      channelId: "111111111111111111",
      data: {
        history: [
          historyEntry(
            GameDB.ACTION_CATEGORIES.CARD,
            GameDB.ACTION_TYPES.DEAL,
            "2026-09-15T08:00:00.000Z"
          ),
          historyEntry(
            GameDB.ACTION_CATEGORIES.CARD,
            GameDB.ACTION_TYPES.PLAY,
            "2026-11-01T08:00:00.000Z"
          ),
        ],
      },
    });
    expect(fromHistory).toBe(Date.parse("2026-09-15T08:00:00.000Z"));

    const channelId = "545109131330191371";
    const snowflake = discordSnowflakeMs(channelId);
    expect(snowflake).toBeGreaterThan(1_000_000_000_000);
    const truncated = Array.from({ length: HISTORY_KEEP_LIMIT }, (_, i) =>
      historyEntry(
        GameDB.ACTION_CATEGORIES.CARD,
        GameDB.ACTION_TYPES.PLAY,
        `2026-11-11T20:00:${String(i % 60).padStart(2, "0")}.000Z`
      )
    );
    expect(
      createdAtMs({
        channelId,
        updatedAt: "2026-11-11 23:00:00",
        data: { history: truncated },
      })
    ).toBe(snowflake);
  });
});

describe("filterAndSortActiveGames", () => {
  test("keeps only this guild's active games for the user, newest first", () => {
    const userId = "will";
    const docs = [
      {
        channelId: "old",
        data: {
          isdeleted: false,
          name: "Old table",
          players: [{ userId }],
          history: [gameCreate("2026-01-01T00:00:00.000Z")],
        },
      },
      {
        channelId: "new",
        data: {
          isdeleted: false,
          name: "New table",
          players: [{ userId: "will" }],
          history: [gameCreate("2026-11-01T00:00:00.000Z")],
        },
      },
      {
        channelId: "deleted",
        data: {
          isdeleted: true,
          name: "Deleted",
          players: [{ userId }],
          history: [gameCreate("2026-12-01T00:00:00.000Z")],
        },
      },
      {
        channelId: "spectator",
        data: {
          isdeleted: false,
          name: "Watching",
          players: [{ userId: "other" }],
          history: [gameCreate("2026-11-15T00:00:00.000Z")],
        },
      },
    ];
    expect(
      filterAndSortActiveGames(docs, userId).map((doc) => doc.channelId)
    ).toEqual(["new", "old"]);
  });
});

function goodGameData() {
  return {
    isdeleted: false,
    name: "Good",
    players: [{ userId: "will" }],
  };
}

function insertRawGameRow(store, channelId, data) {
  store.db
    .query(
      `INSERT INTO game_documents (guild_id, collection, channel_id, data, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    )
    .run("guild-a", GAME_COLLECTION, channelId, data);
}

async function expectListSkipsCorruptData(data, badChannelId) {
  await withStore(async (store) => {
    const logs = [];
    store.logger = { log: (message) => logs.push(String(message)) };
    store.upsertGameData("guild-a", GAME_COLLECTION, "ch-good", goodGameData());
    insertRawGameRow(store, badChannelId, data);

    const rows = store.listGameDocuments("guild-a", GAME_COLLECTION);
    expect(rows.map((row) => row.channelId)).toEqual(["ch-good"]);
    expect(rows[0].data.name).toBe("Good");
    expect(logs.join("\n")).toContain(badChannelId);
    expect(logs.join("\n")).toMatch(/Skipping corrupt game_documents row/);

    const listed = await listActiveGamesForUser({
      gameStore: store,
      guildId: "guild-a",
      userId: "will",
    });
    expect(listed).toEqual({
      status: 200,
      body: { games: [{ channelId: "ch-good", channelName: "Good" }] },
    });
  });
}

describe("GameStore.listGameDocuments", () => {
  test("returns channel_id, updated_at, and parsed data for one guild", async () => {
    await withStore(async (store) => {
      store.upsertGameData("guild-a", GAME_COLLECTION, "ch-1", {
        isdeleted: false,
        name: "Table",
        players: [{ userId: "will" }],
      });
      store.upsertGameData("guild-b", GAME_COLLECTION, "ch-2", {
        isdeleted: false,
        name: "Other guild",
      });
      const rows = store.listGameDocuments("guild-a", GAME_COLLECTION);
      expect(rows).toHaveLength(1);
      expect(rows[0].channelId).toBe("ch-1");
      expect(rows[0].data.name).toBe("Table");
      expect(rows[0].updatedAt).toBeTruthy();
    });
  });

  test("skips unparseable data `{not json` alongside a good row", async () => {
    await expectListSkipsCorruptData("{not json", "ch-bad-json");
  });

  test("skips non-object data `null` alongside a good row", async () => {
    await expectListSkipsCorruptData("null", "ch-bad-null");
  });

  test("skips non-object data `42` alongside a good row", async () => {
    await expectListSkipsCorruptData("42", "ch-bad-number");
  });
});

describe("listActiveGamesForUser", () => {
  test("lists across the guild from the store and prefers Discord channel names", async () => {
    await withStore(async (store) => {
      store.upsertGameData("guild-a", GAME_COLLECTION, "thread-new", {
        isdeleted: false,
        name: "Stale custom title",
        players: [{ userId: "will" }],
        history: [gameCreate("2026-11-10T00:00:00.000Z")],
      });
      store.upsertGameData("guild-a", GAME_COLLECTION, "thread-old", {
        isdeleted: false,
        name: "Old channel",
        players: [{ userId: "will" }],
        history: [gameCreate("2026-10-01T00:00:00.000Z")],
      });
      store.upsertGameData("guild-a", GAME_COLLECTION, "thread-deleted", {
        isdeleted: true,
        name: "Gone",
        players: [{ userId: "will" }],
        history: [gameCreate("2026-11-20T00:00:00.000Z")],
      });
      store.upsertGameData("guild-b", GAME_COLLECTION, "other-guild", {
        isdeleted: false,
        name: "Other server",
        players: [{ userId: "will" }],
        history: [gameCreate("2026-11-30T00:00:00.000Z")],
      });

      const names = {
        "thread-new": "Friday Inis",
        "thread-old": "Monday Poker",
      };
      const result = await listActiveGamesForUser({
        gameStore: store,
        guildId: "guild-a",
        userId: "will",
        fetchChannelName: async (channelId) => names[channelId] || null,
      });
      expect(result.status).toBe(200);
      expect(result.body.games).toEqual([
        { channelId: "thread-new", channelName: "Friday Inis" },
        { channelId: "thread-old", channelName: "Monday Poker" },
      ]);
      expect(JSON.stringify(result.body)).not.toMatch(/Stale custom title|hand|deck|playArea/);
    });
  });

  test("falls back to gameData.name when Discord has no channel", async () => {
    const result = await listActiveGamesForUser({
      gameStore: {
        listGameDocuments: () => [
          {
            channelId: "missing",
            data: {
              isdeleted: false,
              name: "Stored channel name",
              players: [{ userId: "will" }],
              history: [gameCreate("2026-01-01T00:00:00.000Z")],
            },
          },
        ],
      },
      guildId: "guild-a",
      userId: "will",
      fetchChannelName: async () => null,
    });
    expect(result.body.games).toEqual([
      { channelId: "missing", channelName: "Stored channel name" },
    ]);
  });
});

function snapshotSeed(userId = "will") {
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
          simultaneous: [{ id: "sim-1", name: "Simultaneous Only" }],
        },
        playArea: [{ id: "play-1", name: "Village", url: null }],
      },
      {
        userId: "other-player",
        hands: { main: [{ id: "other-secret-1", name: "Other Player Secret" }] },
        playArea: [{ id: "other-play-1", name: "Other Play Area" }],
      },
    ],
    gameBoard: [{ id: "board-1", name: "Province", url: null }],
    decks: [{ name: "Main", piles: { draw: { cards: [{ name: "Hidden Draw" }] } } }],
  };
}

describe("snapshotGameForUser", () => {
  test("returns this player's main hand, play area, and shared board only", async () => {
    await withStore(async (store) => {
      store.upsertGameData("guild-a", GAME_COLLECTION, "thread-game", snapshotSeed());
      const loads = [];
      const result = await snapshotGameForUser({
        gameStore: store,
        getGameData: async (guildId, collection, channelId) => {
          loads.push({ guildId, collection, channelId });
          return store.getSpecificGameData(guildId, collection, channelId);
        },
        guildId: "guild-a",
        channelId: "thread-game",
        userId: "will",
      });
      expect(loads).toEqual([
        { guildId: "guild-a", collection: GAME_COLLECTION, channelId: "thread-game" },
      ]);
      expect(result.status).toBe(200);
      expect(result.body.version).toEqual(expect.any(String));
      expect(result.version).toBe(result.body.version);
      const { version: _version, ...body } = result.body;
      expect(body).toEqual({
        gameName: "Friday Inis",
        channelId: "thread-game",
        guildId: "guild-a",
        hand: [
          { id: "hand-1", name: "Copper", url: null },
          {
            id: "hand-2",
            name: "Gold",
            url: "https://gamebot.example.com/gold.png",
          },
        ],
        playArea: [{ id: "play-1", name: "Village", url: null }],
        gameBoard: [{ id: "board-1", name: "Province", url: null }],
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
        decks: [{ name: "Main", remaining: 1, total: 1 }],
        status: {
          gameName: "Friday Inis",
          reverseOrder: false,
          isCustomGame: false,
          players: [
            {
              userId: "will",
              name: "will",
              order: 0,
              score: "",
              handCount: 2,
              playAreaCount: 1,
              teamName: "",
              color: null,
              isYou: true,
              tokens: {},
            },
            {
              userId: "other-player",
              name: "other-player",
              order: 0,
              score: "",
              handCount: 1,
              playAreaCount: 1,
              teamName: "",
              color: null,
              isYou: false,
              tokens: {},
            },
          ],
          teams: [],
          tokens: [],
          globalPiles: [],
          history: [],
        },
      });
      const json = JSON.stringify(result.body);
      expect(json).not.toContain("Other Player Secret");
      expect(json).not.toContain("other-secret-1");
      expect(json).not.toContain("Other Play Area");
      expect(json).not.toContain("Draft Only");
      expect(json).not.toContain("Simultaneous Only");
      expect(json).not.toContain("Hidden Draw");
      expect(result.body.players).toBeUndefined();
      expect(result.body.decks).toEqual([{ name: "Main", remaining: 1, total: 1 }]);
      expect(MAX_VISIBLE_DECKS).toBe(2);
    });
  });

  test("uses the selected channel id as the game document key, not a launch channel", async () => {
    await withStore(async (store) => {
      store.upsertGameData("guild-a", GAME_COLLECTION, "thread-game", snapshotSeed());
      const launchMiss = await snapshotGameForUser({
        gameStore: store,
        guildId: "guild-a",
        channelId: "activity-launch-channel",
        userId: "will",
      });
      expect(launchMiss).toEqual({ status: 404, body: { error: "no_game" } });
      expect(launchMiss.body.hand).toBeUndefined();

      const hit = await snapshotGameForUser({
        gameStore: store,
        guildId: "guild-a",
        channelId: "thread-game",
        userId: "will",
      });
      expect(hit.status).toBe(200);
      expect(hit.body.channelId).toBe("thread-game");
    });
  });

  test("missing game, deleted game, and non-player are errors with no cards", async () => {
    await withStore(async (store) => {
      store.upsertGameData("guild-a", GAME_COLLECTION, "deleted", {
        ...snapshotSeed(),
        isdeleted: true,
      });
      store.upsertGameData("guild-a", GAME_COLLECTION, "spectator", {
        ...snapshotSeed("someone-else"),
      });

      expect(
        await snapshotGameForUser({
          gameStore: store,
          guildId: "guild-a",
          channelId: "no-such-thread",
          userId: "will",
        })
      ).toEqual({ status: 404, body: { error: "no_game" } });

      const deleted = await snapshotGameForUser({
        gameStore: store,
        guildId: "guild-a",
        channelId: "deleted",
        userId: "will",
      });
      expect(deleted).toEqual({ status: 404, body: { error: "no_game" } });
      expect(JSON.stringify(deleted.body)).not.toMatch(/Copper|Village|Province/);

      const spectator = await snapshotGameForUser({
        gameStore: store,
        guildId: "guild-a",
        channelId: "spectator",
        userId: "will",
      });
      expect(spectator).toEqual({
        status: 403,
        body: { error: "not_a_player" },
      });
      expect(JSON.stringify(spectator.body)).not.toMatch(
        /Copper|Other Player Secret|Province/
      );
    });
  });

  test("prefers getGameDataV2 when the Discord client exposes it", async () => {
    const calls = [];
    const discordClient = {
      getGameDataV2: async (guildId, collection, channelId) => {
        calls.push({ guildId, collection, channelId });
        return snapshotSeed();
      },
    };
    const result = await snapshotGameForUser({
      discordClient,
      guildId: "guild-a",
      channelId: "thread-game",
      userId: "will",
    });
    expect(calls).toEqual([
      { guildId: "guild-a", collection: "game", channelId: "thread-game" },
    ]);
    expect(result.body.hand.map((card) => card.id)).toEqual(["hand-1", "hand-2"]);
  });

  test("enriches other players from Discord and ignores lookup failures", async () => {
    const discordClient = {
      getGameDataV2: async () => snapshotSeed(),
      guilds: {
        cache: { get: () => null },
        fetch: async () => ({
          members: {
            cache: { get: () => null },
            fetch: async (id) => {
              if (id === "other-player") throw new Error("missing");
              return {
                displayName: "WillOnServer",
                displayAvatarURL: () =>
                  "https://cdn.discordapp.com/avatars/will/a.png?size=128",
              };
            },
          },
        }),
      },
    };
    const result = await snapshotGameForUser({
      discordClient,
      guildId: "guild-a",
      channelId: "thread-game",
      userId: "will",
    });
    expect(result.status).toBe(200);
    expect(result.body.status.players[0].name).toBe("WillOnServer");
    expect(result.body.otherPlayers[0].name).toBe("other-player");
    expect(result.body.otherPlayers[0].avatarUrl).toBeNull();
  });

  test("If-None-Match skips Discord member lookups and returns 304", async () => {
    let memberFetches = 0;
    const discordClient = {
      getGameDataV2: async () => snapshotSeed(),
      guilds: {
        cache: {
          get: () => {
            memberFetches += 1;
            return null;
          },
        },
        fetch: async () => {
          memberFetches += 1;
          return {
            members: {
              cache: { get: () => null },
              fetch: async () => ({ displayName: "WillOnServer" }),
            },
          };
        },
      },
    };
    const first = await snapshotGameForUser({
      discordClient,
      guildId: "guild-a",
      channelId: "thread-game",
      userId: "will",
    });
    expect(first.status).toBe(200);
    expect(memberFetches).toBeGreaterThan(0);
    const afterFirst = memberFetches;
    const again = await snapshotGameForUser({
      discordClient,
      guildId: "guild-a",
      channelId: "thread-game",
      userId: "will",
      ifNoneMatch: formatEtag(first.body.version),
    });
    expect(again).toEqual({ status: 304, version: first.body.version });
    expect(memberFetches).toBe(afterFirst);
  });
});

describe("versionGameForUser", () => {
  test("returns a version without Discord member lookups and 304s when unchanged", async () => {
    let memberFetches = 0;
    const game = snapshotSeed();
    const discordClient = {
      getGameDataV2: async () => game,
      guilds: {
        cache: {
          get: () => {
            memberFetches += 1;
            return null;
          },
        },
        fetch: async () => {
          memberFetches += 1;
          throw new Error("version poll must not look up members");
        },
      },
    };
    const first = await versionGameForUser({
      discordClient,
      guildId: "guild-a",
      channelId: "thread-game",
      userId: "will",
    });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      version: snapshotVersion(game, {
        channelId: "thread-game",
        guildId: "guild-a",
        userId: "will",
      }),
    });
    expect(memberFetches).toBe(0);

    const cached = await versionGameForUser({
      discordClient,
      guildId: "guild-a",
      channelId: "thread-game",
      userId: "will",
      ifNoneMatch: formatEtag(first.body.version),
    });
    expect(cached).toEqual({ status: 304, version: first.body.version });
    expect(memberFetches).toBe(0);

    game.gameBoard.push({ id: "board-2", name: "Duchy" });
    const changed = await versionGameForUser({
      discordClient,
      guildId: "guild-a",
      channelId: "thread-game",
      userId: "will",
      ifNoneMatch: formatEtag(first.body.version),
    });
    expect(changed.status).toBe(200);
    expect(changed.body.version).not.toBe(first.body.version);

    const star = await versionGameForUser({
      discordClient,
      guildId: "guild-a",
      channelId: "thread-game",
      userId: "will",
      ifNoneMatch: "*",
    });
    expect(star).toEqual({ status: 304, version: changed.body.version });
  });

  test("fingerprint ignores another player's hidden cards", async () => {
    const game = snapshotSeed();
    const ids = {
      channelId: "thread-game",
      guildId: "guild-a",
      userId: "will",
    };
    const first = await versionGameForUser({
      discordClient: { getGameDataV2: async () => game },
      ...ids,
    });
    expect(first.status).toBe(200);
    expect(first.body.version).toMatch(/^[0-9a-f]{64}$/);
    expect(first.body.version).not.toContain("|");
    expect(first.body.version).not.toContain("Other Player Secret");
    expect(snapshotVersion(game, ids)).toBe(first.body.version);

    game.players[1].hands.main[0].name = "King";
    game.players[1].hands.main[0].id = "other-secret-swapped";
    const hiddenOnly = await versionGameForUser({
      discordClient: { getGameDataV2: async () => game },
      ...ids,
      ifNoneMatch: formatEtag(first.body.version),
    });
    expect(hiddenOnly).toEqual({ status: 304, version: first.body.version });

    game.gameBoard.push({ id: "board-2", name: "Duchy" });
    const visible = await versionGameForUser({
      discordClient: { getGameDataV2: async () => game },
      ...ids,
      ifNoneMatch: formatEtag(first.body.version),
    });
    expect(visible.status).toBe(200);
    expect(visible.body.version).not.toBe(first.body.version);
  });
});

describe("etagMatches", () => {
  test("matches the formatted tag, weak tags, and *", () => {
    const version = "abc|1";
    expect(etagMatches(formatEtag(version), version)).toBe(true);
    expect(etagMatches(`W/${formatEtag(version)}`, version)).toBe(true);
    expect(etagMatches("*", version)).toBe(true);
    expect(etagMatches('"other"', version)).toBe(false);
    expect(etagMatches("*", "")).toBe(false);
  });
});

describe("snapshotFromGameData", () => {
  test("keeps card description on the viewer's hand, play area, and board", () => {
    const snapshot = snapshotFromGameData(
      {
        name: "Described",
        players: [
          {
            userId: "will",
            hands: {
              main: [{ id: "h1", name: "Copper", description: "Basic treasure" }],
            },
            playArea: [{ id: "p1", name: "Village", description: "Worth 1 action." }],
          },
        ],
        gameBoard: [{ id: "b1", name: "Province", description: "8 points" }],
      },
      { channelId: "ch", guildId: "g", userId: "will" }
    );
    expect(snapshot.hand[0].description).toBe("Basic treasure");
    expect(snapshot.playArea[0].description).toBe("Worth 1 action.");
    expect(snapshot.gameBoard[0].description).toBe("8 points");
  });

  test("empty hands and missing playArea become empty arrays", () => {
    const snapshot = snapshotFromGameData(
      {
        name: "Bare",
        players: [{ userId: "will", hands: {} }],
      },
      { channelId: "ch", guildId: "g", userId: "will" }
    );
    expect(snapshot.hand).toEqual([]);
    expect(snapshot.playArea).toEqual([]);
    expect(snapshot.gameBoard).toEqual([]);
    expect(snapshot.otherPlayers).toEqual([]);
    expect(snapshot.decks).toEqual([]);
    expect(snapshot.status.players).toEqual([
      expect.objectContaining({ userId: "will", isYou: true, handCount: 0 }),
    ]);
  });

  test("other players expose name and hand count, never their cards", () => {
    const snapshot = snapshotFromGameData(
      {
        name: "Table",
        players: [
          {
            userId: "will",
            name: "Will",
            order: 1,
            hands: { main: [{ id: "mine", name: "Copper" }] },
          },
          {
            userId: "riley",
            name: "Riley",
            order: 2,
            hands: { main: [{ id: "secret-card", name: "Hidden Riley Card" }] },
            playArea: [{ id: "their-play", name: "Riley Play Card" }],
          },
        ],
        decks: [
          {
            name: "Main",
            allCards: [{ name: "A" }, { name: "B" }],
            piles: { draw: { cards: [{ name: "Hidden Draw Card" }] } },
          },
          { name: "Events", allCards: [1, 2, 3], piles: { draw: { cards: [{}, {}] } } },
          { name: "Unused Chaos Deck", allCards: [1], piles: { draw: { cards: [{}] } } },
        ],
      },
      { channelId: "ch", guildId: "g", userId: "will" }
    );
    expect(snapshot.otherPlayers).toEqual([
      {
        userId: "riley",
        name: "Riley",
        handCount: 1,
        avatarUrl: null,
        teamId: "",
        teamName: "",
      },
    ]);
    expect(snapshot.decks.map((deck) => deck.name)).toEqual(["Main", "Events"]);
    expect(snapshot.decks[0]).toEqual({ name: "Main", remaining: 1, total: 2 });
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain("Hidden Riley Card");
    expect(json).not.toContain("Riley Play Card");
    expect(json).not.toContain("secret-card");
    expect(json).not.toContain("Hidden Draw Card");
    expect(json).not.toContain("Unused Chaos Deck");
  });

  test("hides hand counts and extra deck cards when hiddenInfo says so", () => {
    const snapshot = snapshotFromGameData(
      {
        name: "Secret Hands",
        reverseOrder: true,
        tokens: [{ id: "clue", name: "Clue", isSecret: true, cap: 5 }],
        players: [
          {
            userId: "will",
            name: "Will",
            tokens: { clue: 2 },
            hands: { main: [{ id: "a" }, { id: "b" }] },
          },
          {
            userId: "riley",
            name: "Riley",
            tokens: { clue: 3 },
            hands: { main: [{ id: "c" }] },
          },
        ],
        decks: [
          {
            name: "Main",
            hiddenInfo: "hand",
            allCards: Array.from({ length: 10 }),
            piles: { draw: { cards: [{}, {}, {}] } },
          },
        ],
      },
      { channelId: "ch", guildId: "g", userId: "will" }
    );
    expect(snapshot.otherPlayers[0].handCount).toBe("?");
    expect(snapshot.status.players.map((row) => row.handCount)).toEqual(["?", "?"]);
    expect(snapshot.status.players[0].tokens.clue).toBe(2);
    expect(snapshot.status.players[1].tokens.clue).toBe("?");
    expect(snapshot.status.reverseOrder).toBe(true);
    expect(snapshot.decks[0]).toEqual({ name: "Main", remaining: 3, total: 10 });
  });

  test("uses Discord display names and avatar URLs when provided", () => {
    const snapshot = snapshotFromGameData(
      {
        name: "Named",
        players: [
          { userId: "will", name: "fallback", hands: { main: [] } },
          { userId: "riley", hands: { main: [{}] } },
        ],
      },
      {
        channelId: "ch",
        guildId: "g",
        userId: "will",
        playerDisplays: {
          will: { name: "WillOnServer", avatarUrl: "https://cdn.discordapp.com/avatars/will/a.png" },
          riley: { name: "RileyOnServer", avatarUrl: "https://cdn.discordapp.com/avatars/riley/a.png" },
        },
      }
    );
    expect(snapshot.status.players[0].name).toBe("WillOnServer");
    expect(snapshot.otherPlayers[0]).toEqual({
      userId: "riley",
      name: "RileyOnServer",
      handCount: 1,
      avatarUrl: "https://cdn.discordapp.com/avatars/riley/a.png",
      teamId: "",
      teamName: "",
    });
  });

  test("exposes roster team names on other players and status", () => {
    const snapshot = snapshotFromGameData(
      {
        name: "Game time",
        teams: [
          { id: "crab", name: "🦀🦀", color: null },
          { id: "fish", name: "💪🐟", color: "navy" },
        ],
        players: [
          { userId: "will", name: "Will", order: 0, teamId: "crab", hands: { main: [] } },
          { userId: "riley", name: "Riley", order: 1, teamId: "crab", hands: { main: [{}] } },
          { userId: "alex", name: "Alex", order: 2, teamId: "fish", hands: { main: [{}] } },
          { userId: "solo", name: "Solo", order: 3, hands: { main: [{}] } },
        ],
      },
      { channelId: "ch", guildId: "g", userId: "will" }
    );
    expect(snapshot.status.teams).toEqual([
      { id: "crab", name: "🦀🦀", color: null },
      { id: "fish", name: "💪🐟", color: "navy" },
    ]);
    expect(snapshot.status.players.map((row) => [row.name, row.teamName])).toEqual([
      ["Will", "🦀🦀"],
      ["Riley", "🦀🦀"],
      ["Alex", "💪🐟"],
      ["Solo", ""],
    ]);
    expect(snapshot.otherPlayers.map((row) => [row.name, row.teamId, row.teamName])).toEqual([
      ["Riley", "crab", "🦀🦀"],
      ["Alex", "fish", "💪🐟"],
      ["Solo", "", ""],
    ]);
  });

  test("history rows keep id and timestamp so the client can flash new ones", () => {
    const snapshot = snapshotFromGameData(
      {
        name: "Logged",
        players: [{ userId: "will", hands: { main: [] } }],
        history: [
          {
            id: "hist-1",
            timestamp: "2026-11-16T21:00:00.000Z",
            summary: "Will dealt 1 cards from Main",
            action: { category: "card" },
          },
          {
            id: 7,
            timestamp: "2026-11-16T21:01:00.000Z",
            summary: "Riley played Village",
            action: { category: "card" },
          },
        ],
      },
      { channelId: "ch", guildId: "g", userId: "will" }
    );
    expect(snapshot.status.history).toEqual([
      {
        id: "hist-1",
        timestamp: "2026-11-16T21:00:00.000Z",
        summary: "Will dealt 1 cards from Main",
        category: "card",
      },
      {
        id: "7",
        timestamp: "2026-11-16T21:01:00.000Z",
        summary: "Riley played Village",
        category: "card",
      },
    ]);
  });

  test("matches player teamId to roster id after stringifying", () => {
    const snapshot = snapshotFromGameData(
      {
        name: "Ids",
        teams: [{ id: "7", name: "🦀🦀" }],
        players: [
          { userId: "will", name: "Will", teamId: 7, hands: { main: [] } },
          { userId: "riley", name: "Riley", teamId: 7, hands: { main: [{}] } },
        ],
      },
      { channelId: "ch", guildId: "g", userId: "will" }
    );
    expect(snapshot.otherPlayers[0]).toMatchObject({
      name: "Riley",
      teamId: "7",
      teamName: "🦀🦀",
    });
  });
});

describe("optionalDiscordAccessGuard", () => {
  test("404 member is not_a_player; other Discord errors fail open", async () => {
    const denied = await optionalDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "thread-game",
      userId: "will",
      fetchImpl: async (url) => {
        if (String(url).includes("/members/")) {
          return { status: 404 };
        }
        return { status: 200 };
      },
    });
    expect(denied).toEqual({
      ok: false,
      status: 403,
      body: { error: "not_a_player" },
    });

    const urls = [];
    const open = await optionalDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "thread-game",
      userId: "will",
      fetchImpl: async (url) => {
        urls.push(String(url));
        return { status: 500 };
      },
    });
    expect(open).toEqual({ ok: true });
    expect(urls[0]).toBe(`${DISCORD_API_BASE}/guilds/guild-a/members/will`);
    expect(urls[1]).toBe(`${DISCORD_API_BASE}/channels/thread-game`);
  });

  test("skips Discord when there is no bot token", async () => {
    let called = false;
    const result = await optionalDiscordAccessGuard({
      guildId: "guild-a",
      channelId: "thread-game",
      userId: "will",
      fetchImpl: async () => {
        called = true;
        throw new Error("should not run");
      },
    });
    expect(result).toEqual({ ok: true });
    expect(called).toBe(false);
  });
});

describe("requiredDiscordAccessGuard", () => {
  const { withDiscordAccess } = require("./helpers/discordAccess");
  const { PermissionFlagsBits } = require("discord.js");

  test("allows a guild member who can view a channel in that guild", async () => {
    const allowed = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "table-1",
        userId: "will",
        memberNick: "WillNick",
      }),
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.member.nick).toBe("WillNick");
  });

  test("404 member is not_a_guild_member; missing token and Discord errors fail closed", async () => {
    const denied = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "table-1",
        userId: "will",
        memberStatus: 404,
      }),
    });
    expect(denied).toEqual({
      ok: false,
      status: 403,
      body: { error: "not_a_guild_member" },
    });

    const noToken = await requiredDiscordAccessGuard({
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl: async () => {
        throw new Error("should not run");
      },
    });
    expect(noToken).toEqual({
      ok: false,
      status: 403,
      body: { error: "access_unverified" },
    });

    const discordDown = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl: async () => {
        throw new Error("network");
      },
    });
    expect(discordDown).toEqual({
      ok: false,
      status: 403,
      body: { error: "access_unverified" },
    });
  });

  test("rejects a channel from another guild and a view-channel deny overwrite", async () => {
    const mismatch = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "table-1",
        userId: "will",
        channelGuildId: "guild-b",
      }),
    });
    expect(mismatch).toEqual({
      ok: false,
      status: 403,
      body: { error: "channel_mismatch" },
    });

    const hidden = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "table-1",
        userId: "will",
        overwrites: [
          {
            id: "will",
            deny: String(PermissionFlagsBits.ViewChannel),
            allow: "0",
          },
        ],
      }),
    });
    expect(hidden).toEqual({
      ok: false,
      status: 403,
      body: { error: "forbidden" },
    });
  });

  test("Administrator and guild owner bypass channel overwrites", async () => {
    const hiddenEveryone = [
      {
        id: "guild-a",
        deny: String(PermissionFlagsBits.ViewChannel),
        allow: "0",
      },
    ];
    const admin = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "table-1",
        userId: "will",
        everyonePermissions: "0",
        memberRoles: ["admin-role"],
        extraRoles: [
          {
            id: "admin-role",
            permissions: String(PermissionFlagsBits.Administrator),
          },
        ],
        overwrites: hiddenEveryone,
      }),
    });
    expect(admin.ok).toBe(true);

    const owner = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "table-1",
        userId: "will",
        everyonePermissions: "0",
        ownerId: "will",
        overwrites: hiddenEveryone,
      }),
    });
    expect(owner.ok).toBe(true);
  });

  test("role and member overwrites deny or allow ViewChannel", async () => {
    const roleDeny = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "table-1",
        userId: "will",
        memberRoles: ["hidden-role"],
        extraRoles: [{ id: "hidden-role", permissions: "0" }],
        overwrites: [
          {
            id: "hidden-role",
            deny: String(PermissionFlagsBits.ViewChannel),
            allow: "0",
          },
        ],
      }),
    });
    expect(roleDeny).toEqual({
      ok: false,
      status: 403,
      body: { error: "forbidden" },
    });

    const roleAllow = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "table-1",
        userId: "will",
        everyonePermissions: "0",
        memberRoles: ["see-role"],
        extraRoles: [{ id: "see-role", permissions: "0" }],
        overwrites: [
          {
            id: "see-role",
            deny: "0",
            allow: String(PermissionFlagsBits.ViewChannel),
          },
        ],
      }),
    });
    expect(roleAllow.ok).toBe(true);

    const memberAllow = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "table-1",
        userId: "will",
        everyonePermissions: "0",
        overwrites: [
          {
            id: "guild-a",
            deny: String(PermissionFlagsBits.ViewChannel),
            allow: "0",
          },
          {
            id: "will",
            deny: "0",
            allow: String(PermissionFlagsBits.ViewChannel),
          },
        ],
      }),
    });
    expect(memberAllow.ok).toBe(true);
  });

  test("public threads use parent channel permissions", async () => {
    const { ChannelType } = require("discord.js");
    const allowed = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "public-thread",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "public-thread",
        userId: "will",
        channelType: ChannelType.PublicThread,
        parentId: "parent-channel",
      }),
    });
    expect(allowed.ok).toBe(true);

    const hiddenParent = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "public-thread",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "public-thread",
        userId: "will",
        channelType: ChannelType.PublicThread,
        parentId: "parent-channel",
        parentOverwrites: [
          {
            id: "will",
            deny: String(PermissionFlagsBits.ViewChannel),
            allow: "0",
          },
        ],
      }),
    });
    expect(hiddenParent).toEqual({
      ok: false,
      status: 403,
      body: { error: "forbidden" },
    });
  });

  test("private threads require membership or MANAGE_THREADS", async () => {
    const { ChannelType } = require("discord.js");
    const member = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "private-thread",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "private-thread",
        userId: "will",
        channelType: ChannelType.PrivateThread,
        parentId: "parent-channel",
        threadMemberStatus: 200,
      }),
    });
    expect(member.ok).toBe(true);

    const outsider = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "private-thread",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "private-thread",
        userId: "will",
        channelType: ChannelType.PrivateThread,
        parentId: "parent-channel",
        threadMemberStatus: 404,
      }),
    });
    expect(outsider).toEqual({
      ok: false,
      status: 403,
      body: { error: "forbidden" },
    });

    const manager = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "private-thread",
      userId: "will",
      fetchImpl: withDiscordAccess(async () => {
        throw new Error("unexpected");
      }, {
        guildId: "guild-a",
        channelId: "private-thread",
        userId: "will",
        channelType: ChannelType.PrivateThread,
        parentId: "parent-channel",
        threadMemberStatus: 404,
        memberRoles: ["mod-role"],
        extraRoles: [
          {
            id: "mod-role",
            permissions: String(PermissionFlagsBits.ManageThreads),
          },
        ],
      }),
    });
    expect(manager.ok).toBe(true);
  });

  test("caches Discord lookups and retries a cheap 429 once", async () => {
    const cache = createDiscordLookupCache({ ttlMs: 60_000 });
    const calls = [];
    const fetchImpl = withDiscordAccess(
      async () => {
        throw new Error("unexpected");
      },
      {
        guildId: "guild-a",
        channelId: "table-1",
        userId: "will",
        calls,
      }
    );
    const first = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl,
      lookupCache: cache,
    });
    const second = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-a",
      channelId: "table-1",
      userId: "will",
      fetchImpl,
      lookupCache: cache,
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(calls).toHaveLength(4);

    const waited = [];
    let memberHits = 0;
    const rateLimited = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-b",
      channelId: "table-2",
      userId: "will",
      wait: async (ms) => {
        waited.push(ms);
      },
      fetchImpl: async (url) => {
        if (String(url).includes("/members/")) {
          memberHits += 1;
          if (memberHits === 1) {
            return {
              status: 429,
              headers: { get: (name) => (name === "retry-after" ? "0" : null) },
              json: async () => ({ retry_after: 0 }),
            };
          }
        }
        return withDiscordAccess(
          async () => {
            throw new Error("unexpected");
          },
          {
            guildId: "guild-b",
            channelId: "table-2",
            userId: "will",
          }
        )(url);
      },
    });
    expect(rateLimited.ok).toBe(true);
    expect(memberHits).toBe(2);
    expect(waited).toEqual([0]);

    const expensiveWaits = [];
    const stillLimited = await requiredDiscordAccessGuard({
      botToken: "bot-token",
      guildId: "guild-c",
      channelId: "table-3",
      userId: "will",
      wait: async (ms) => {
        expensiveWaits.push(ms);
      },
      fetchImpl: async () => ({
        status: 429,
        headers: { get: (name) => (name === "retry-after" ? "5" : null) },
        json: async () => ({ retry_after: 5 }),
      }),
    });
    expect(stillLimited).toEqual({
      ok: false,
      status: 403,
      body: { error: "try_again" },
    });
    expect(expensiveWaits).toEqual([]);
  });
});

describe("memberChannelPermissions", () => {
  const { PermissionFlagsBits } = require("discord.js");
  const VIEW = PermissionFlagsBits.ViewChannel;

  test("Administrator-only and owner bits include ViewChannel past a deny overwrite", () => {
    const hiddenEveryone = [
      {
        id: "guild-a",
        deny: String(VIEW),
        allow: "0",
      },
    ];
    const adminBits = memberChannelPermissions({
      member: { user: { id: "will" }, roles: ["admin-role"] },
      channel: { permission_overwrites: hiddenEveryone },
      roles: [
        { id: "guild-a", permissions: "0" },
        {
          id: "admin-role",
          permissions: String(PermissionFlagsBits.Administrator),
        },
      ],
      guildId: "guild-a",
      ownerId: "someone-else",
    });
    expect((adminBits & VIEW) === VIEW).toBe(true);

    const ownerBits = memberChannelPermissions({
      member: { user: { id: "will" }, roles: [] },
      channel: { permission_overwrites: hiddenEveryone },
      roles: [{ id: "guild-a", permissions: "0" }],
      guildId: "guild-a",
      ownerId: "will",
    });
    expect((ownerBits & VIEW) === VIEW).toBe(true);
  });
});
