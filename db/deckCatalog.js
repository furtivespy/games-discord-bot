const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");
const { ensureDataDir } = require("./dataDir.js");

const DECK_CATALOG_FILENAME = "deck_catalog.sqlite";

const LOCKED_CODES = new Set([
  "SQLITE_BUSY",
  "SQLITE_LOCKED",
  "SQLITE_BUSY_SNAPSHOT",
  "SQLITE_BUSY_RECOVERY",
  "SQLITE_BUSY_TIMEOUT",
]);

const CORRUPT_CODES = new Set([
  "SQLITE_CORRUPT",
  "SQLITE_NOTADB",
  "SQLITE_CORRUPT_VTAB",
  "SQLITE_IOERR_SHORT_READ",
]);

class DeckCatalog {
  constructor(options = {}) {
    this.dbPath = DeckCatalog.resolvePath(options);
    this.db = openDeckCatalogDatabase(this.dbPath);
  }

  static resolvePath(options = {}) {
    if (options.dbPath) return options.dbPath;
    const dataDir = options.dataDir || ensureDataDir();
    return path.join(dataDir, DECK_CATALOG_FILENAME);
  }

  static inspect(options = {}) {
    const dbPath = DeckCatalog.resolvePath(options);
    if (!fs.existsSync(dbPath)) {
      return inspectResult({ dbPath, exists: false, hasSchema: false });
    }
    try {
      const db = new Database(dbPath, { readonly: true });
      try {
        const table = db
          .query(
            `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deck_templates'`
          )
          .get();
        if (!table) {
          return inspectResult({ dbPath, exists: true, hasSchema: false });
        }
        const count =
          db.query(`SELECT COUNT(*) AS count FROM deck_templates`).get()
            ?.count ?? 0;
        return inspectResult({
          dbPath,
          exists: true,
          hasSchema: true,
          count,
        });
      } finally {
        db.close();
      }
    } catch (error) {
      return inspectResult({
        dbPath,
        exists: true,
        hasSchema: false,
        error: classifySqliteOpenError(error),
        errorMessage: String(error?.message || error),
      });
    }
  }

  listTemplates() {
    const rows = this.db
      .query(
        `SELECT id, name, enabled, created_by, created_at, updated_at, cards
         FROM deck_templates
         ORDER BY name`
      )
      .all();
    return rows.map(parseTemplateRow);
  }

  getTemplate(id) {
    const row = this.db
      .query(
        `SELECT id, name, enabled, created_by, created_at, updated_at, cards
         FROM deck_templates
         WHERE id = ?`
      )
      .get(id);
    return row ? parseTemplateRow(row) : null;
  }

  hasId(id) {
    return (
      this.db.query(`SELECT 1 FROM deck_templates WHERE id = ?`).get(id) != null
    );
  }

  hasName(name) {
    return (
      this.db.query(`SELECT 1 FROM deck_templates WHERE name = ?`).get(name) !=
      null
    );
  }

  insertTemplate({
    id,
    name,
    cards,
    createdBy = "seed",
    enabled = 1,
  }) {
    this.db
      .query(
        `INSERT INTO deck_templates (id, name, enabled, created_by, created_at, updated_at, cards)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), ?)`
      )
      .run(
        id,
        name,
        normalizeEnabled(enabled),
        createdBy,
        JSON.stringify(cards)
      );
  }

  setEnabled(id, enabled) {
    this.db
      .query(
        `UPDATE deck_templates
         SET enabled = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(normalizeEnabled(enabled), id);
  }

  transaction(fn) {
    return this.db.transaction(fn)();
  }

  count() {
    return (
      this.db.query(`SELECT COUNT(*) AS count FROM deck_templates`).get()
        ?.count ?? 0
    );
  }

  close() {
    this.db.close();
  }
}

function inspectResult({
  dbPath,
  exists,
  hasSchema,
  count = 0,
  error = null,
  errorMessage = null,
}) {
  return { exists, hasSchema, count, dbPath, error, errorMessage };
}

function isCatalogEnabled(enabled) {
  return Number(enabled) === 1;
}

function normalizeEnabled(enabled) {
  return isCatalogEnabled(enabled) ? 1 : 0;
}

function classifySqliteOpenError(error) {
  const code = error?.code;
  const message = String(error?.message || "");
  if (LOCKED_CODES.has(code) || /database is locked/i.test(message)) {
    return "locked";
  }
  if (
    CORRUPT_CODES.has(code) ||
    /malformed|not a database/i.test(message)
  ) {
    return "corrupt";
  }
  return "unreadable";
}

function sqliteUniqueField(error) {
  const code = error?.code;
  const message = String(error?.message || "");
  const isUnique =
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    /UNIQUE constraint failed/i.test(message);
  if (!isUnique) return null;
  if (/\.id\b/.test(message) || code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
    return "id";
  }
  if (/\.name\b/.test(message)) {
    return "name";
  }
  return "unknown";
}

function parseCardsJson(raw) {
  if (raw == null || raw === "") {
    return { cards: [], cardsError: "missing" };
  }
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : JSON.parse(String(raw));
  } catch {
    return { cards: [], cardsError: "invalid_json" };
  }
  if (!Array.isArray(parsed)) {
    return { cards: [], cardsError: "not_array" };
  }
  return { cards: parsed, cardsError: null };
}

function parseTemplateRow(row) {
  const { cards, cardsError } = parseCardsJson(row.cards);
  const template = {
    id: row.id,
    name: row.name,
    enabled: normalizeEnabled(row.enabled),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    cards,
  };
  if (cardsError) template.cardsError = cardsError;
  return template;
}

function openDeckCatalogDatabase(dbPath) {
  const db = new Database(dbPath, { create: true });
  db.exec(`PRAGMA journal_mode = WAL`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS deck_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      cards TEXT NOT NULL
    );
  `);
  return db;
}

module.exports = DeckCatalog;
module.exports.DECK_CATALOG_FILENAME = DECK_CATALOG_FILENAME;
module.exports.isCatalogEnabled = isCatalogEnabled;
module.exports.normalizeEnabled = normalizeEnabled;
module.exports.classifySqliteOpenError = classifySqliteOpenError;
module.exports.sqliteUniqueField = sqliteUniqueField;
module.exports.parseTemplateRow = parseTemplateRow;
