const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const GameStore = require("../db/gameStore");
const {
  CREATED_AT_SIGNAL,
  createdAtMs,
  discordSnowflakeMs,
  filterAndSortActiveGames,
  isActivePlayerGame,
  listActiveGamesForUser,
  userIsPlayer,
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
  test("prefers GAME CREATE history over later activity and updated_at", () => {
    expect(CREATED_AT_SIGNAL).toContain("GAME CREATE");
    const ms = createdAtMs({
      channelId: "111111111111111111",
      updatedAt: "2026-11-11 23:00:00",
      data: {
        history: [
          historyEntry("game", "create", "2026-10-01T12:00:00.000Z"),
          historyEntry("card", "play", "2026-11-11T20:00:00.000Z"),
        ],
      },
    });
    expect(ms).toBe(Date.parse("2026-10-01T12:00:00.000Z"));
  });

  test("falls back to earliest history, then channel snowflake", () => {
    const fromHistory = createdAtMs({
      channelId: "111111111111111111",
      data: {
        history: [
          historyEntry("card", "deal", "2026-09-15T08:00:00.000Z"),
          historyEntry("card", "play", "2026-11-01T08:00:00.000Z"),
        ],
      },
    });
    expect(fromHistory).toBe(Date.parse("2026-09-15T08:00:00.000Z"));

    const channelId = "545109131330191371";
    const snowflake = discordSnowflakeMs(channelId);
    expect(snowflake).toBeGreaterThan(1_000_000_000_000);
    expect(
      createdAtMs({
        channelId,
        data: { history: [] },
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
          history: [historyEntry("game", "create", "2026-01-01T00:00:00.000Z")],
        },
      },
      {
        channelId: "new",
        data: {
          isdeleted: false,
          name: "New table",
          players: [{ userId: "will" }],
          history: [historyEntry("game", "create", "2026-11-01T00:00:00.000Z")],
        },
      },
      {
        channelId: "deleted",
        data: {
          isdeleted: true,
          name: "Deleted",
          players: [{ userId }],
          history: [historyEntry("game", "create", "2026-12-01T00:00:00.000Z")],
        },
      },
      {
        channelId: "spectator",
        data: {
          isdeleted: false,
          name: "Watching",
          players: [{ userId: "other" }],
          history: [historyEntry("game", "create", "2026-11-15T00:00:00.000Z")],
        },
      },
    ];
    expect(
      filterAndSortActiveGames(docs, userId).map((doc) => doc.channelId)
    ).toEqual(["new", "old"]);
  });
});

describe("GameStore.listGameDocuments", () => {
  test("returns channel_id, updated_at, and parsed data for one guild", async () => {
    await withStore(async (store) => {
      store.upsertGameData("guild-a", "game", "ch-1", {
        isdeleted: false,
        name: "Table",
        players: [{ userId: "will" }],
      });
      store.upsertGameData("guild-b", "game", "ch-2", {
        isdeleted: false,
        name: "Other guild",
      });
      const rows = store.listGameDocuments("guild-a", "game");
      expect(rows).toHaveLength(1);
      expect(rows[0].channelId).toBe("ch-1");
      expect(rows[0].data.name).toBe("Table");
      expect(rows[0].updatedAt).toBeTruthy();
    });
  });
});

describe("listActiveGamesForUser", () => {
  test("lists across the guild from the store and prefers Discord channel names", async () => {
    await withStore(async (store) => {
      store.upsertGameData("guild-a", "game", "thread-new", {
        isdeleted: false,
        name: "Stale custom title",
        players: [{ userId: "will" }],
        history: [historyEntry("game", "create", "2026-11-10T00:00:00.000Z")],
      });
      store.upsertGameData("guild-a", "game", "thread-old", {
        isdeleted: false,
        name: "Old channel",
        players: [{ userId: "will" }],
        history: [historyEntry("game", "create", "2026-10-01T00:00:00.000Z")],
      });
      store.upsertGameData("guild-a", "game", "thread-deleted", {
        isdeleted: true,
        name: "Gone",
        players: [{ userId: "will" }],
        history: [historyEntry("game", "create", "2026-11-20T00:00:00.000Z")],
      });
      store.upsertGameData("guild-b", "game", "other-guild", {
        isdeleted: false,
        name: "Other server",
        players: [{ userId: "will" }],
        history: [historyEntry("game", "create", "2026-11-30T00:00:00.000Z")],
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
              history: [historyEntry("game", "create", "2026-01-01T00:00:00.000Z")],
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
