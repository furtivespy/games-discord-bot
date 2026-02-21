const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");

const DATA_DIR = path.resolve("./data");
const SOURCE_DB_PATH = path.join(DATA_DIR, "enmap.sqlite");
const MODE = process.argv.includes("--merge") ? "merge" : "replace";

const TABLE_MAPPINGS = [
  { legacyTable: "settings", targetStore: "settings" },
  { legacyTable: "exclusions", targetStore: "exclusions" },
  { legacyTable: "gamedata", targetStore: "gamedata" },
  { legacyTable: "guilddata", targetStore: "guilddata" },
  { legacyTable: "reminders", targetStore: "reminders" },
  { legacyTable: "userpreferences", targetStore: "userPreferences" },
];

function assertSourceExists() {
  if (!fs.existsSync(SOURCE_DB_PATH)) {
    throw new Error(`Legacy DB not found: ${SOURCE_DB_PATH}`);
  }
}

function backupFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filePath}.bak.${stamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function parseLegacyValue(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  try {
    return JSON.parse(rawValue);
  } catch {
    return Function(`"use strict"; return (${rawValue});`)();
  }
}

function migrateTable(sourceDb, mapping) {
  const { legacyTable, targetStore } = mapping;
  const rows = sourceDb.query(`SELECT key, value FROM ${legacyTable}`).all();

  const targetPath = path.join(DATA_DIR, `${targetStore}.sqlite`);
  const backupPath = backupFileIfExists(targetPath);
  const targetDb = new Database(targetPath, { create: true });

  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS enmap_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  if (MODE === "replace") {
    targetDb.exec("DELETE FROM enmap_store;");
  }

  const insert = targetDb.query(
    "INSERT INTO enmap_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );

  const tx = targetDb.transaction((records) => {
    for (const row of records) {
      const parsed = parseLegacyValue(row.value);
      insert.run(String(row.key), JSON.stringify(parsed));
    }
  });
  tx(rows);

  targetDb.close();

  return {
    legacyTable,
    targetStore,
    migrated: rows.length,
    backupPath,
  };
}

function main() {
  assertSourceExists();
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const sourceDb = new Database(SOURCE_DB_PATH, { readonly: true });
  const results = TABLE_MAPPINGS.map((mapping) => migrateTable(sourceDb, mapping));
  sourceDb.close();

  console.log(`Migration complete (mode: ${MODE}).`);
  for (const row of results) {
    const backupText = row.backupPath ? `, backup: ${row.backupPath}` : "";
    console.log(
      `- ${row.legacyTable} -> ${row.targetStore}: ${row.migrated} rows${backupText}`
    );
  }
}

try {
  main();
} catch (err) {
  console.error(`Migration failed: ${err.message}`);
  process.exit(1);
}
