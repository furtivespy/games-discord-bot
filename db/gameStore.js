const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");
const { resolveDataDir, ensureDataDir } = require("./dataDir.js");
const { trace, SpanStatusCode } = require("@opentelemetry/api");

const tracer = trace.getTracer("discord-bot:db");

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
    return tracer.startActiveSpan("db.upsert game_documents", (span) => {
      span.setAttributes({
        "db.system": "sqlite",
        "db.operation": "INSERT",
        "db.sql.table": "game_documents",
        "db.collection": collection,
      });
      try {
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
      } catch (err) {
        span.recordError(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  getSpecificGameData(guildId, collection, channelId) {
    return tracer.startActiveSpan("db.get game_documents", (span) => {
      span.setAttributes({
        "db.system": "sqlite",
        "db.operation": "SELECT",
        "db.sql.table": "game_documents",
        "db.collection": collection,
      });
      try {
        const row = this.db
          .query(
            `SELECT channel_id, data
             FROM game_documents
             WHERE guild_id = ? AND collection = ? AND channel_id = ?`
          )
          .get(String(guildId), collection, String(channelId));

        span.setAttribute("db.found", row !== null);
        return row ? this._parseRow(row) : null;
      } catch (err) {
        span.recordError(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  queryGameData(guildId, collection, query) {
    return tracer.startActiveSpan("db.query game_documents", (span) => {
      span.setAttributes({
        "db.system": "sqlite",
        "db.operation": "SELECT",
        "db.sql.table": "game_documents",
        "db.collection": collection,
        "db.filter.bgg_game_id": query.bggGameId !== undefined,
      });
      try {
        if (query.bggGameId !== undefined) {
          const rows = this.db
            .query(
              `SELECT channel_id, data
               FROM game_documents
               WHERE guild_id = ? AND collection = ? AND bgg_game_id = ?`
            )
            .all(String(guildId), collection, String(query.bggGameId));
          span.setAttribute("db.result_count", rows.length);
          return rows.map((row) => this._parseRow(row));
        }

        const rows = this.db
          .query(
            `SELECT channel_id, data
             FROM game_documents
             WHERE guild_id = ? AND collection = ?`
          )
          .all(String(guildId), collection);

        const results = rows
          .map((row) => this._parseRow(row))
          .filter((doc) => this._matchesQuery(doc, query));
        span.setAttribute("db.result_count", results.length);
        return results;
      } catch (err) {
        span.recordError(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw err;
      } finally {
        span.end();
      }
    });
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
