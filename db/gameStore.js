const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");
const { ensureDataDir } = require("./dataDir.js");
const { trace, SpanStatusCode } = require("@opentelemetry/api");

const tracer = trace.getTracer("discord-bot:db");

class GameStore {
  constructor(options = {}) {
    this.logger = options.logger;
    const dataDir = ensureDataDir();
    this.dbPath = path.join(dataDir, "game_documents.sqlite");
    this.db = openGameDocumentsDatabase(this.dbPath);
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
        span.recordException(err);
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
        span.recordException(err);
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
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  getDocumentsByCollection(collection) {
    return tracer.startActiveSpan("db.list game_documents", (span) => {
      span.setAttributes({
        "db.system": "sqlite",
        "db.operation": "SELECT",
        "db.sql.table": "game_documents",
        "db.collection": collection,
      });
      try {
        const rows = this.db
          .query(
            `SELECT guild_id, channel_id, data
             FROM game_documents
             WHERE collection = ?
             ORDER BY CASE WHEN guild_id = 'global' THEN 0 ELSE 1 END, guild_id, channel_id`
          )
          .all(collection);
        span.setAttribute("db.result_count", rows.length);
        return rows.map((row) => ({
          guildId: row.guild_id,
          channelId: row.channel_id,
          data: this._parseRow(row),
        }));
      } catch (err) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  getGameRawRow(guildId, collection, channelId) {
    return this.db
      .query(
        `SELECT guild_id, collection, channel_id, data, updated_at
         FROM game_documents
         WHERE guild_id = ? AND collection = ? AND channel_id = ?`
      )
      .get(String(guildId), collection, String(channelId));
  }

  runDiagnostic() {
    const result = {};

    result.journalMode = this.db.query("PRAGMA journal_mode").get()?.journal_mode ?? "unknown";
    result.synchronous = this.db.query("PRAGMA synchronous").get()?.synchronous ?? "unknown";

    const g = "__diag__";
    const testData = { _diag: true, ts: Date.now() };
    try {
      this.upsertGameData(g, g, g, testData);
      const readBack = this.getSpecificGameData(g, g, g);
      result.cycleOk = readBack?._diag === true && readBack?.ts === testData.ts;
      result.cycleError = null;
    } catch (e) {
      result.cycleOk = false;
      result.cycleError = e.message;
    } finally {
      try {
        this.db
          .query("DELETE FROM game_documents WHERE guild_id = ? AND collection = ? AND channel_id = ?")
          .run(g, g, g);
      } catch {}
    }

    return result;
  }

  reset() {
    const backupPath = this.createBackup();

    this.db.close();
    if (fs.existsSync(this.dbPath)) fs.unlinkSync(this.dbPath);

    this.db = openGameDocumentsDatabase(this.dbPath);

    return backupPath;
  }

  createBackup() {
    const checkpoint = this.db.query("PRAGMA wal_checkpoint(TRUNCATE)").get();
    if (Number(checkpoint?.busy) !== 0) {
      throw new Error("Could not safely checkpoint the SQLite WAL for backup");
    }
    return backupFileIfExists(this.dbPath);
  }

  restoreFromBackup(backupPath) {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Database backup does not exist: ${backupPath}`);
    }

    this.db.close();
    for (const suffix of ["-wal", "-shm"]) {
      const sidecarPath = `${this.dbPath}${suffix}`;
      if (fs.existsSync(sidecarPath)) fs.unlinkSync(sidecarPath);
    }
    fs.copyFileSync(backupPath, this.dbPath);
    this.db = openGameDocumentsDatabase(this.dbPath);
  }
}

function openGameDocumentsDatabase(dbPath) {
  const db = new Database(dbPath, { create: true });
  db.exec(`PRAGMA journal_mode = WAL`);
  db.exec(`
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
  return db;
}

function backupFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filePath}.bak.${stamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

module.exports = GameStore;
