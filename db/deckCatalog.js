const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");
const { ensureDataDir } = require("./dataDir.js");

const DECK_CATALOG_FILENAME = "deck_catalog.sqlite";

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
      return { exists: false, hasSchema: false, count: 0, dbPath };
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
          return { exists: true, hasSchema: false, count: 0, dbPath };
        }
        const count =
          db.query(`SELECT COUNT(*) AS count FROM deck_templates`).get()
            ?.count ?? 0;
        return { exists: true, hasSchema: true, count, dbPath };
      } finally {
        db.close();
      }
    } catch {
      return { exists: true, hasSchema: false, count: 0, dbPath };
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

  listEnabledTemplateNames() {
    return this.db
      .query(
        `SELECT id, name FROM deck_templates WHERE enabled = 1 ORDER BY name`
      )
      .all();
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
        enabled ? 1 : 0,
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
      .run(enabled ? 1 : 0, id);
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

function parseTemplateRow(row) {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    cards: JSON.parse(row.cards),
  };
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
