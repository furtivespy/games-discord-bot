const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");
const { resolveDataDir, ensureDataDir } = require("./dataDir.js");

class GameStore {
  constructor(options = {}) {
    this.logger = options.logger;
    const dataDir = ensureDataDir();

    this.db = new Database(path.join(dataDir, "game_documents.sqlite"), {
      create: true,
    });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_documents (
        guild_id TEXT NOT NULL,
        collection TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        bgg_game_id TEXT,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (guild_id, collection, channel_id)
      );
      CREATE INDEX IF NOT EXISTS idx_game_bgg
        ON game_documents (guild_id, collection, bgg_game_id)
        WHERE bgg_game_id IS NOT NULL;
    `);
  }

  _extractBggGameId(data) {
    if (data?.bggGameId == null || data.bggGameId === "") return null;
    return String(data.bggGameId);
  }

  _parseRow(row) {
    const game = JSON.parse(row.data);
    if (!game.id) game.id = row.channel_id;
    return game;
  }

  _matchesQuery(doc, query) {
    for (const [field, expected] of Object.entries(query)) {
      if (String(doc[field]) !== String(expected)) return false;
    }
    return true;
  }

  upsertGameData(guildId, collection, channelId, data) {
    const bggGameId =
      collection === "game" ? this._extractBggGameId(data) : null;

    this.db
      .query(
        `INSERT INTO game_documents (guild_id, collection, channel_id, bgg_game_id, data, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT (guild_id, collection, channel_id) DO UPDATE SET
           bgg_game_id = excluded.bgg_game_id,
           data = excluded.data,
           updated_at = datetime('now')`
      )
      .run(
        String(guildId),
        collection,
        String(channelId),
        bggGameId,
        JSON.stringify(data)
      );
  }

  getSpecificGameData(guildId, collection, channelId) {
    const row = this.db
      .query(
        `SELECT channel_id, data
         FROM game_documents
         WHERE guild_id = ? AND collection = ? AND channel_id = ?`
      )
      .get(String(guildId), collection, String(channelId));

    if (!row) return null;
    return this._parseRow(row);
  }

  queryGameData(guildId, collection, query) {
    if (query.bggGameId !== undefined) {
      const rows = this.db
        .query(
          `SELECT channel_id, data
           FROM game_documents
           WHERE guild_id = ? AND collection = ? AND bgg_game_id = ?`
        )
        .all(String(guildId), collection, String(query.bggGameId));

      return rows.map((row) => this._parseRow(row));
    }

    const rows = this.db
      .query(
        `SELECT channel_id, data
         FROM game_documents
         WHERE guild_id = ? AND collection = ?`
      )
      .all(String(guildId), collection);

    return rows
      .map((row) => this._parseRow(row))
      .filter((doc) => this._matchesQuery(doc, query));
  }

  reset() {
    const dataDir = resolveDataDir();
    const dbPath = path.join(dataDir, "game_documents.sqlite");
    const backupPath = backupFileIfExists(dbPath);

    this.db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    this.db = new Database(dbPath, { create: true });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_documents (
        guild_id TEXT NOT NULL,
        collection TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        bgg_game_id TEXT,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (guild_id, collection, channel_id)
      );
      CREATE INDEX IF NOT EXISTS idx_game_bgg
        ON game_documents (guild_id, collection, bgg_game_id)
        WHERE bgg_game_id IS NOT NULL;
    `);

    return backupPath;
  }
}

function backupFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filePath}.bak.${stamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

module.exports = GameStore;
