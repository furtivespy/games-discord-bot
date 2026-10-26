const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const GameStore = require("../db/gameStore.js");
const { formatGameLookup, logMoneyGameMiss } = require("../modules/gameLookupDebug.js");

function withStore(run) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "game-lookup-"));
  const previous = process.env.GAMEBOT_DATA_DIR;
  process.env.GAMEBOT_DATA_DIR = dataDir;
  const store = new GameStore();
  try {
    return run(store);
  } finally {
    try { store.db.close(); } catch {}
    if (previous === undefined) delete process.env.GAMEBOT_DATA_DIR;
    else process.env.GAMEBOT_DATA_DIR = previous;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

describe("inspectGameLookup", () => {
  test("reports an active game and a same-channel row from another guild", () => {
    withStore((store) => {
      store.upsertGameData("guild-a", "game", "channel-1", {
        name: "Merchant of Venus",
        isdeleted: false,
        players: [{ userId: "p1" }, { userId: "p2" }],
      });
      store.upsertGameData("guild-b", "game", "channel-1", {
        name: "Other guild",
        isdeleted: true,
        players: [],
      });

      const inspection = store.inspectGameLookup("guild-a", "game", "channel-1");
      expect(inspection.guildGameCount).toBe(1);
      expect(inspection.exact).toMatchObject({
        guildId: "guild-a",
        name: "Merchant of Venus",
        isdeleted: false,
        playerCount: 2,
        parseError: null,
      });
      expect(inspection.channelRows).toHaveLength(2);
      expect(inspection.dbPath).toContain("game_documents.sqlite");

      const line = formatGameLookup(inspection);
      expect(line).toContain("name=\"Merchant of Venus\"");
      expect(line).toContain("guild=guild-b");
      expect(line).toContain("guildGames=1");
    });
  });

  test("reports a missing row and a corrupt document", () => {
    withStore((store) => {
      store.db
        .query(
          `INSERT INTO game_documents (guild_id, collection, channel_id, bgg_game_id, data, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run("guild-a", "game", "channel-2", null, "{not-json", "2026-10-25 00:00:00");

      const missing = store.inspectGameLookup("guild-a", "game", "channel-missing");
      expect(missing.exact).toBeNull();
      expect(missing.guildGameCount).toBe(1);
      expect(missing.channelRows).toEqual([]);

      const corrupt = store.inspectGameLookup("guild-a", "game", "channel-2");
      expect(corrupt.exact.parseError).toBeTruthy();
      expect(corrupt.exact.name).toBeNull();
      expect(corrupt.exact.isdeleted).toBeNull();
    });
  });
});

describe("logMoneyGameMiss", () => {
  test("logs the subcommand, player, and stored row when /money finds no game", () => {
    withStore((store) => {
      store.upsertGameData("guild-a", "game", "channel-1", {
        name: "Merchant of Venus",
        isdeleted: false,
        players: [{ userId: "p1" }],
      });
      const warnings = [];
      const client = {
        db: store,
        logger: { warn: (line) => warnings.push(line) },
      };
      const interaction = {
        guildId: "guild-a",
        channelId: "channel-1",
        user: { id: "player-9" },
        channel: { isThread: () => true, parentId: "parent-1" },
        options: { getSubcommand: () => "spend" },
      };

      logMoneyGameMiss(client, interaction, null);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("[game-lookup] /money spend");
      expect(warnings[0]).toContain("user=player-9");
      expect(warnings[0]).toContain("thread=true");
      expect(warnings[0]).toContain("parent=parent-1");
      expect(warnings[0]).toContain('"present":false');
      expect(warnings[0]).toContain("name=\"Merchant of Venus\"");
      expect(warnings[0]).toContain("isdeleted=false");
    });
  });
});
