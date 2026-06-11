const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");
const GameStore = require("./gameStore.js");
const { resolveDataDir, ensureDataDir } = require("./dataDir.js");

const LEGACY_GAMEDATA_PREFIXES = new Set([
  "game",
  "secret",
  "bgg",
  "suggest",
]);

function backupFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filePath}.bak.${stamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function parseStoredValue(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  try {
    return JSON.parse(rawValue);
  } catch {
    return Function(`"use strict"; return (${rawValue});`)();
  }
}

function inferGuildId(data) {
  if (data?.guildId) return String(data.guildId);
  for (const player of data?.players ?? []) {
    if (player?.guildId) return String(player.guildId);
  }
  return null;
}

function parseGamedataKey(key) {
  const dashIndex = key.indexOf("-");
  if (dashIndex <= 0) return null;

  const collection = key.slice(0, dashIndex);
  const channelId = key.slice(dashIndex + 1);
  if (!LEGACY_GAMEDATA_PREFIXES.has(collection) || !channelId) return null;

  return { collection, channelId };
}

function migrateGamedataRows(store, rows, { guildHint = null, sourceLabel }) {
  let migrated = 0;
  let skipped = 0;
  const warnings = [];

  for (const row of rows) {
    const parsed = parseGamedataKey(String(row.key));
    if (!parsed) {
      skipped++;
      continue;
    }

    const data = parseStoredValue(row.value);
    let guildId = inferGuildId(data);
    if (
      !guildId &&
      guildHint &&
      (parsed.collection === "bgg" || parsed.collection === "suggest")
    ) {
      guildId = String(guildHint);
    }
    if (!guildId) {
      skipped++;
      warnings.push(
        `Skipped ${row.key} from ${sourceLabel}: could not infer guild_id`
      );
      continue;
    }

    store.upsertGameData(guildId, parsed.collection, parsed.channelId, data);
    migrated++;
  }

  return { migrated, skipped, warnings, sourceLabel, rowCount: rows.length };
}

function readEnmapStoreRows(dataDir, storeName) {
  const dbPath = path.join(dataDir, `${storeName}.sqlite`);
  if (!fs.existsSync(dbPath)) return null;

  const sourceDb = new Database(dbPath, { readonly: true });
  const rows = sourceDb.query("SELECT key, value FROM enmap_store").all();
  sourceDb.close();
  return { dbPath, rows };
}

function readLegacyEnmapRows(dataDir, tableName) {
  const dbPath = path.join(dataDir, "enmap.sqlite");
  if (!fs.existsSync(dbPath)) return null;

  const sourceDb = new Database(dbPath, { readonly: true });
  const table = sourceDb
    .query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    )
    .get(tableName);
  if (!table) {
    sourceDb.close();
    return null;
  }

  const rows = sourceDb.query(`SELECT key, value FROM ${tableName}`).all();
  sourceDb.close();
  return { dbPath, rows };
}

function countEnmapStoreRows(dbPath) {
  try {
    const db = new Database(dbPath, { readonly: true });
    const row = db.query("SELECT COUNT(*) as n FROM enmap_store").get();
    db.close();
    return row.n;
  } catch {
    return null;
  }
}

function inspectSqliteFile(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return { exists: false };
  }

  const stat = fs.statSync(dbPath);
  return {
    exists: true,
    bytes: stat.size,
    rows: countEnmapStoreRows(dbPath),
  };
}

function inspectDataLocations() {
  const activeDir = resolveDataDir();
  const dirs = [{ label: "active", dir: activeDir }];

  if (process.env.IS_ON_FLY === "true" && activeDir !== "/app/data") {
    dirs.push({ label: "/app/data (legacy cwd path)", dir: "/app/data" });
  }

  return dirs.map(({ label, dir }) => {
    const files = {};
    for (const name of [
      "gamedata.sqlite",
      "guilddata.sqlite",
      "game_documents.sqlite",
      "settings.sqlite",
    ]) {
      files[name] = inspectSqliteFile(path.join(dir, name));
    }
    return { label, dir, files };
  });
}

function mergeMigrationResults(results) {
  const merged = {
    migrated: 0,
    skipped: 0,
    warnings: [],
    sources: [],
  };

  for (const result of results) {
    if (!result) continue;
    merged.migrated += result.migrated;
    merged.skipped += result.skipped;
    merged.warnings.push(...result.warnings);
    merged.sources.push({
      sourceLabel: result.sourceLabel,
      rowCount: result.rowCount,
      migrated: result.migrated,
      skipped: result.skipped,
    });
  }

  return merged;
}

function migrateEnmapGamedata(store, { guildHint = null } = {}) {
  const dataDir = resolveDataDir();
  const results = [];

  const split = readEnmapStoreRows(dataDir, "gamedata");
  if (split && split.rows.length > 0) {
    results.push(
      migrateGamedataRows(store, split.rows, {
        guildHint,
        sourceLabel: split.dbPath,
      })
    );
  } else {
    const legacy = readLegacyEnmapRows(dataDir, "gamedata");
    if (legacy) {
      results.push(
        migrateGamedataRows(store, legacy.rows, {
          guildHint,
          sourceLabel: `${legacy.dbPath}#gamedata`,
        })
      );
    }
  }

  if (results.length === 0) {
    return {
      migrated: 0,
      skipped: 0,
      warnings: [
        `No gamedata sources found under ${dataDir} (expected gamedata.sqlite or enmap.sqlite)`,
      ],
      sources: [],
    };
  }

  return mergeMigrationResults(results);
}

function migrateEnmapGuilddata(store) {
  const dataDir = resolveDataDir();
  const sources = [];
  let migrated = 0;

  const split = readEnmapStoreRows(dataDir, "guilddata");
  if (split && split.rows.length > 0) {
    for (const row of split.rows) {
      const guildId = String(row.key);
      const data = parseStoredValue(row.value);
      store.upsertGameData(guildId, "custom_data", "main", data);
      migrated++;
    }
    sources.push({
      sourceLabel: split.dbPath,
      rowCount: split.rows.length,
      migrated: split.rows.length,
      skipped: 0,
    });
  } else {
    const legacy = readLegacyEnmapRows(dataDir, "guilddata");
    if (legacy) {
      for (const row of legacy.rows) {
        const guildId = String(row.key);
        const data = parseStoredValue(row.value);
        store.upsertGameData(guildId, "custom_data", "main", data);
        migrated++;
      }
      sources.push({
        sourceLabel: `${legacy.dbPath}#guilddata`,
        rowCount: legacy.rows.length,
        migrated: legacy.rows.length,
        skipped: 0,
      });
    }
  }

  if (sources.length === 0) {
    return {
      migrated: 0,
      skipped: 0,
      warnings: [
        `No guilddata sources found under ${dataDir} (expected guilddata.sqlite or enmap.sqlite)`,
      ],
      sources: [],
    };
  }

  return { migrated, skipped: 0, warnings: [], sources };
}

function migrateFromEnmapCaches(store, caches, { guildHint = null } = {}) {
  const rows = [];

  if (caches.gamedata) {
    for (const [key, value] of caches.gamedata.entries()) {
      rows.push({ key, value: JSON.stringify(value) });
    }
  }

  if (rows.length === 0) {
    return { migrated: 0, skipped: 0, warnings: [], sources: [] };
  }

  return migrateGamedataRows(store, rows, {
    guildHint,
    sourceLabel: "in-memory gamedata cache",
  });
}

function migrateGuilddataCache(store, guilddataCache) {
  if (!guilddataCache || guilddataCache.size === 0) {
    return { migrated: 0, skipped: 0, warnings: [], sources: [] };
  }

  let migrated = 0;
  for (const [guildId, value] of guilddataCache.entries()) {
    store.upsertGameData(String(guildId), "custom_data", "main", value);
    migrated++;
  }

  return {
    migrated,
    skipped: 0,
    warnings: [],
    sources: [
      {
        sourceLabel: "in-memory guilddata cache",
        rowCount: guilddataCache.size,
        migrated,
        skipped: 0,
      },
    ],
  };
}

async function migrateFromMongo(store, mongoUri) {
  let MongoClient;
  try {
    ({ MongoClient } = require("mongodb"));
  } catch {
    throw new Error(
      "mongodb package is required for Mongo migration. Install it temporarily with: bun add mongodb"
    );
  }

  const client = new MongoClient(mongoUri);
  let migrated = 0;

  try {
    await client.connect();
    const adminDb = client.db().admin();
    const { databases } = await adminDb.listDatabases();

    for (const entry of databases) {
      const dbName = entry.name;
      if (["admin", "local", "config"].includes(dbName)) continue;

      const db = client.db(dbName);
      const collections = await db.listCollections().toArray();

      for (const collectionInfo of collections) {
        const collectionName = collectionInfo.name;
        const docs = await db.collection(collectionName).find({}).toArray();

        for (const doc of docs) {
          const channelId = doc.id != null ? String(doc.id) : null;
          if (!channelId) continue;

          const { _id, id, ...rest } = doc;
          const data = { ...rest, id: channelId };
          store.upsertGameData(dbName, collectionName, channelId, data);
          migrated++;
        }
      }
    }
  } finally {
    await client.close();
  }

  return { migrated, skipped: 0, warnings: [] };
}

function formatMigrationSummary(result) {
  const lines = [`Migration complete (mode: ${result.mode}).`, `data dir: ${result.dataDir}`];

  for (const location of result.inspection ?? []) {
    lines.push(`[${location.label}] ${location.dir}`);
    for (const [name, info] of Object.entries(location.files)) {
      if (!info.exists) {
        lines.push(`  ${name}: missing`);
        continue;
      }
      const rowText = info.rows == null ? "?" : info.rows;
      lines.push(`  ${name}: ${info.bytes} bytes, ${rowText} rows`);
    }
  }

  if (result.backupPath) {
    lines.push(`Backup: ${result.backupPath}`);
  }

  lines.push(
    `gamedata: ${result.gamedata.migrated} migrated, ${result.gamedata.skipped} skipped`
  );
  for (const source of result.gamedata.sources ?? []) {
    lines.push(
      `  - ${source.sourceLabel}: ${source.rowCount} rows, ${source.migrated} migrated, ${source.skipped} skipped`
    );
  }

  lines.push(`guilddata: ${result.guilddata.migrated} migrated`);
  for (const source of result.guilddata.sources ?? []) {
    lines.push(
      `  - ${source.sourceLabel}: ${source.rowCount} rows, ${source.migrated} migrated`
    );
  }

  if (result.cache?.gamedata?.migrated || result.cache?.guilddata?.migrated) {
    lines.push(
      `cache: gamedata ${result.cache.gamedata?.migrated ?? 0}, guilddata ${result.cache.guilddata?.migrated ?? 0}`
    );
  }

  if (result.mongo) {
    lines.push(`MongoDB: ${result.mongo.migrated} migrated`);
  } else if (result.mongoSkippedReason) {
    lines.push(`MongoDB: ${result.mongoSkippedReason}`);
  }

  const warnings = [
    ...(result.gamedata.warnings ?? []),
    ...(result.guilddata.warnings ?? []),
  ].slice(0, 10);
  for (const warning of warnings) {
    lines.push(`warning: ${warning}`);
  }
  if ((result.gamedata.warnings?.length ?? 0) + (result.guilddata.warnings?.length ?? 0) > 10) {
    lines.push(`warning: ...and more`);
  }

  return lines.join("\n");
}

async function runGameDocumentsMigration({
  store,
  mode = "replace",
  mongoUri = null,
  guildHint = null,
  caches = null,
} = {}) {
  const dataDir = ensureDataDir();
  const inspection = inspectDataLocations();

  const gameStore = store ?? new GameStore();
  let backupPath = null;

  if (mode === "replace") {
    backupPath = gameStore.reset();
  }

  const gamedataFromDisk = migrateEnmapGamedata(gameStore, { guildHint });
  const guilddataFromDisk = migrateEnmapGuilddata(gameStore);

  let cache = null;
  if (caches) {
    const gamedataCache = migrateFromEnmapCaches(gameStore, caches, {
      guildHint,
    });
    const guilddataCache = migrateGuilddataCache(
      gameStore,
      caches.guilddata ?? null
    );
    cache = { gamedata: gamedataCache, guilddata: guilddataCache };
  }

  let mongo = null;
  let mongoSkippedReason = null;

  if (mongoUri) {
    mongo = await migrateFromMongo(gameStore, mongoUri);
  } else {
    mongoSkippedReason = "skipped (no mongo URI provided)";
  }

  const result = {
    mode,
    dataDir,
    inspection,
    backupPath,
    gamedata: gamedataFromDisk,
    guilddata: guilddataFromDisk,
    cache,
    mongo,
    mongoSkippedReason,
  };

  return {
    ...result,
    summary: formatMigrationSummary(result),
  };
}

module.exports = {
  runGameDocumentsMigration,
  formatMigrationSummary,
};
