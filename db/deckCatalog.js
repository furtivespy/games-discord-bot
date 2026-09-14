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
    const key = normalizeDisplayName(name);
    if (!key) return false;
    const rows = this.db.query(`SELECT name FROM deck_templates`).all();
    return rows.some((row) => normalizeDisplayName(row.name) === key);
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
        canonicalDisplayName(name),
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

  ensureNameNocaseUniqueIndex() {
    return ensureNameNocaseUniqueIndex(this.db);
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

function canonicalDisplayName(name) {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}

function normalizeDisplayName(name) {
  return canonicalDisplayName(name).toLowerCase();
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
  if (
    /\.name\b/.test(message) ||
    /idx_deck_templates_name_nocase/i.test(message)
  ) {
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

const NAME_NOCASE_INDEX = "idx_deck_templates_name_nocase";

function nameNocaseIndexExists(db) {
  return (
    db
      .query(
        `SELECT 1 AS ok FROM sqlite_master WHERE type = 'index' AND name = ?`
      )
      .get(NAME_NOCASE_INDEX) != null
  );
}

function findNameNocaseCollisions(db) {
  return db
    .query(
      `SELECT json_group_array(id) AS ids,
              json_group_array(name) AS names,
              COUNT(*) AS count
       FROM deck_templates
       GROUP BY name COLLATE NOCASE
       HAVING COUNT(*) > 1`
    )
    .all()
    .map((row) => ({
      ids: JSON.parse(row.ids),
      names: JSON.parse(row.names),
      count: Number(row.count),
    }));
}

// Precedence: keep every existing row. Do not merge, rename, or delete
// case-variant names. If any NOCASE collision exists, skip the unique index.
function ensureNameNocaseUniqueIndex(db) {
  if (nameNocaseIndexExists(db)) {
    return { status: "already", collisions: [] };
  }
  const collisions = findNameNocaseCollisions(db);
  if (collisions.length > 0) {
    return { status: "skipped", collisions };
  }
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS ${NAME_NOCASE_INDEX}
     ON deck_templates(name COLLATE NOCASE)`
  );
  return { status: "created", collisions: [] };
}

function formatNameNocaseIndexSkip(collisions) {
  const groups = (collisions || []).map((group) =>
    (group.ids || [])
      .map((id, i) => `"${group.names?.[i] ?? ""}" (${id})`)
      .join(", ")
  );
  const detail = groups.length ? groups.join("; ") : "case-variant names";
  return `Case-insensitive name index was not created: existing templates already differ only by case (all rows kept): ${detail}.`;
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
  // idx_deck_templates_name_nocase is created by seedDeckCatalog /migrate
  // after collision detection. Old name TEXT UNIQUE is BINARY, so "Foo" and
  // "foo" can already coexist; creating the index here would throw and make
  // every command/autocomplete open treat the catalog as unreadable.
  return db;
}

module.exports = DeckCatalog;
module.exports.DECK_CATALOG_FILENAME = DECK_CATALOG_FILENAME;
module.exports.NAME_NOCASE_INDEX = NAME_NOCASE_INDEX;
module.exports.isCatalogEnabled = isCatalogEnabled;
module.exports.normalizeEnabled = normalizeEnabled;
module.exports.classifySqliteOpenError = classifySqliteOpenError;
module.exports.sqliteUniqueField = sqliteUniqueField;
module.exports.parseTemplateRow = parseTemplateRow;
module.exports.canonicalDisplayName = canonicalDisplayName;
module.exports.normalizeDisplayName = normalizeDisplayName;
module.exports.findNameNocaseCollisions = findNameNocaseCollisions;
module.exports.ensureNameNocaseUniqueIndex = ensureNameNocaseUniqueIndex;
module.exports.formatNameNocaseIndexSkip = formatNameNocaseIndexSkip;
