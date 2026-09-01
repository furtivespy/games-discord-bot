const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Database } = require("bun:sqlite");
const GameStore = require("../db/gameStore.js");
const {
  consolidateGlobalSuggestions,
  runSuggestionRecoveryMigration,
  RECOVERY_BACKUP_FILENAME,
  RECOVERY_MARKER_FILENAME,
} = require("../db/migrateGameDocuments.js");

describe("consolidateGlobalSuggestions", () => {
  test("merges server lists into global storage without deleting backups", () => {
    const documents = [
      {
        guildId: "global",
        channelId: "x",
        data: { suggestions: [{ id: "global-id", suggestion: "Global" }] },
      },
      {
        guildId: "guild-a",
        channelId: "x",
        data: {
          suggestions: [
            { id: "global-id", suggestion: "Stale copy" },
            { id: "guild-a-id", suggestion: "Guild A" },
          ],
        },
      },
      {
        guildId: "guild-b",
        channelId: "x",
        data: { suggestions: [{ id: "guild-b-id", suggestion: "Guild B" }] },
      },
    ];
    const writes = [];
    const store = {
      getDocumentsByCollection: (collection) => {
        expect(collection).toBe("suggest");
        return documents;
      },
      upsertGameData: (...args) => writes.push(args),
    };

    const result = consolidateGlobalSuggestions(store);

    expect(result).toEqual({
      sourceDocumentCount: 2,
      globalDocumentFound: true,
      suggestionsKept: 3,
      duplicateCount: 1,
    });
    expect(writes).toEqual([
      [
        "global",
        "suggest",
        "x",
        {
          suggestions: [
            { id: "global-id", suggestion: "Global" },
            { id: "guild-a-id", suggestion: "Guild A" },
            { id: "guild-b-id", suggestion: "Guild B" },
          ],
        },
      ],
    ]);
    expect(documents).toHaveLength(3);
  });

  test("keeps legacy suggestions without ids", () => {
    const writes = [];
    const store = {
      getDocumentsByCollection: () => [
        {
          guildId: "guild-a",
          channelId: "x",
          data: { suggestions: [{ suggestion: "Legacy" }] },
        },
      ],
      upsertGameData: (...args) => writes.push(args),
    };

    const result = consolidateGlobalSuggestions(store);

    expect(result.suggestionsKept).toBe(1);
    expect(result.duplicateCount).toBe(0);
    expect(writes[0][3]).toEqual({
      suggestions: [{ suggestion: "Legacy" }],
    });
  });
});

test("restores the recovery backup once and then creates backup only", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "suggest-recovery-"));
  const previousDataDir = process.env.GAMEBOT_DATA_DIR;
  process.env.GAMEBOT_DATA_DIR = dataDir;

  const store = new GameStore();
  try {
    store.upsertGameData("guild-a", "game", "old-game", { restored: true });
    store.upsertGameData("guild-a", "suggest", "x", {
      suggestions: [{ id: "suggestion-id", suggestion: "Keep this" }],
    });
    fs.copyFileSync(
      store.createBackup(),
      path.join(dataDir, RECOVERY_BACKUP_FILENAME)
    );

    store.reset();
    store.upsertGameData("guild-a", "game", "replacement-game", {
      replacement: true,
    });

    const firstRun = runSuggestionRecoveryMigration({ store, dataDir });

    expect(firstRun.status).toBe("completed");
    expect(store.getSpecificGameData("guild-a", "game", "old-game")).toMatchObject({
      restored: true,
    });
    expect(
      store.getSpecificGameData("guild-a", "game", "replacement-game")
    ).toBeNull();
    expect(
      store.getSpecificGameData("global", "suggest", "x").suggestions
    ).toHaveLength(1);
    expect(fs.existsSync(path.join(dataDir, RECOVERY_MARKER_FILENAME))).toBe(
      true
    );

    const secondRun = runSuggestionRecoveryMigration({ store, dataDir });

    expect(secondRun.status).toBe("already completed");
    expect(fs.existsSync(secondRun.currentBackupPath)).toBe(true);
    expect(store.getSpecificGameData("guild-a", "game", "old-game")).toMatchObject({
      restored: true,
    });
  } finally {
    store.db.close();
    if (previousDataDir === undefined) {
      delete process.env.GAMEBOT_DATA_DIR;
    } else {
      process.env.GAMEBOT_DATA_DIR = previousDataDir;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("creates a backup but leaves data unchanged when the recovery source is missing", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "suggest-recovery-"));
  const previousDataDir = process.env.GAMEBOT_DATA_DIR;
  process.env.GAMEBOT_DATA_DIR = dataDir;

  const store = new GameStore();
  try {
    store.upsertGameData("guild-a", "game", "current-game", {
      current: true,
    });

    expect(() => runSuggestionRecoveryMigration({ store, dataDir })).toThrow(
      "Recovery backup does not exist"
    );
    expect(
      store.getSpecificGameData("guild-a", "game", "current-game")
    ).toMatchObject({ current: true });
    expect(fs.existsSync(path.join(dataDir, RECOVERY_MARKER_FILENAME))).toBe(
      false
    );
  } finally {
    store.db.close();
    if (previousDataDir === undefined) {
      delete process.env.GAMEBOT_DATA_DIR;
    } else {
      process.env.GAMEBOT_DATA_DIR = previousDataDir;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("rolls back to the fresh backup when suggestion consolidation fails", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "suggest-recovery-"));
  const previousDataDir = process.env.GAMEBOT_DATA_DIR;
  process.env.GAMEBOT_DATA_DIR = dataDir;

  const store = new GameStore();
  try {
    store.upsertGameData("guild-a", "game", "recovery-game", {
      recovered: true,
    });
    store.upsertGameData("guild-a", "suggest", "x", {
      suggestions: [{ id: "bad-suggestion", suggestion: "Broken" }],
    });
    fs.copyFileSync(
      store.createBackup(),
      path.join(dataDir, RECOVERY_BACKUP_FILENAME)
    );

    const recoveryDatabase = new Database(
      path.join(dataDir, RECOVERY_BACKUP_FILENAME)
    );
    recoveryDatabase
      .query(
        `UPDATE game_documents
         SET data = 'not valid JSON'
         WHERE collection = 'suggest'`
      )
      .run();
    recoveryDatabase.close();

    store.reset();
    store.upsertGameData("guild-a", "game", "current-game", {
      current: true,
    });

    expect(() => runSuggestionRecoveryMigration({ store, dataDir })).toThrow();
    expect(
      store.getSpecificGameData("guild-a", "game", "current-game")
    ).toMatchObject({ current: true });
    expect(
      store.getSpecificGameData("guild-a", "game", "recovery-game")
    ).toBeNull();
    expect(fs.existsSync(path.join(dataDir, RECOVERY_MARKER_FILENAME))).toBe(
      false
    );
  } finally {
    store.db.close();
    if (previousDataDir === undefined) {
      delete process.env.GAMEBOT_DATA_DIR;
    } else {
      process.env.GAMEBOT_DATA_DIR = previousDataDir;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
