const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");
const GameStore = require("./gameStore.js");

const DATA_DIR = path.resolve("./data");

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
  if (data?.players?.[0]?.guildId) return String(data.players[0].guildId);
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

function openEnmapDb(storeName) {
  const dbPath = path.join(DATA_DIR, `${storeName}.sqlite`);
  if (!fs.existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true });
}

function migrateEnmapGamedata(store) {
  const sourceDb = openEnmapDb("gamedata");
  if (!sourceDb) {
    return { migrated: 0, skipped: 0, warnings: ["gamedata.sqlite not found"] };
  }

  const rows = sourceDb.query("SELECT key, value FROM enmap_store").all();
  sourceDb.close();

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
    const guildId = inferGuildId(data);
    if (!guildId) {
      skipped++;
      warnings.push(
        `Skipped ${row.key}: could not infer guild_id (Enmap keys are not guild-scoped for bgg/suggest)`
      );
      continue;
    }

    store.upsertGameData(guildId, parsed.collection, parsed.channelId, data);
    migrated++;
  }

  return { migrated, skipped, warnings };
}

function migrateEnmapGuilddata(store) {
  const sourceDb = openEnmapDb("guilddata");
  if (!sourceDb) {
    return { migrated: 0, skipped: 0, warnings: ["guilddata.sqlite not found"] };
  }

  const rows = sourceDb.query("SELECT key, value FROM enmap_store").all();
  sourceDb.close();

  let migrated = 0;
  for (const row of rows) {
    const guildId = String(row.key);
    const data = parseStoredValue(row.value);
    store.upsertGameData(guildId, "custom_data", "main", data);
    migrated++;
  }

  return { migrated, skipped: 0, warnings: [] };
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
  const lines = [
    `Migration complete (mode: ${result.mode}).`,
  ];

  if (result.backupPath) {
    lines.push(`Backup: ${result.backupPath}`);
  }

  lines.push(
    `gamedata: ${result.gamedata.migrated} migrated, ${result.gamedata.skipped} skipped`
  );
  lines.push(`guilddata: ${result.guilddata.migrated} migrated`);

  if (result.mongo) {
    lines.push(`MongoDB: ${result.mongo.migrated} migrated`);
  } else if (result.mongoSkippedReason) {
    lines.push(`MongoDB: ${result.mongoSkippedReason}`);
  }

  const warnings = result.gamedata.warnings.slice(0, 10);
  for (const warning of warnings) {
    lines.push(`warning: ${warning}`);
  }
  if (result.gamedata.warnings.length > 10) {
    lines.push(
      `warning: ...and ${result.gamedata.warnings.length - 10} more`
    );
  }

  return lines.join("\n");
}

async function runGameDocumentsMigration({
  store,
  mode = "replace",
  mongoUri = null,
} = {}) {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const gameStore = store ?? new GameStore();
  let backupPath = null;

  if (mode === "replace") {
    backupPath = gameStore.reset();
  }

  const gamedata = migrateEnmapGamedata(gameStore);
  const guilddata = migrateEnmapGuilddata(gameStore);

  let mongo = null;
  let mongoSkippedReason = null;

  if (mongoUri) {
    mongo = await migrateFromMongo(gameStore, mongoUri);
  } else {
    mongoSkippedReason = "skipped (no mongo URI provided)";
  }

  const result = {
    mode,
    backupPath,
    gamedata,
    guilddata,
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
