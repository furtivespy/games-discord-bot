const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");
const GameStore = require("./gameStore.js");
const { ensureDataDir } = require("./dataDir.js");

const GLOBAL_SUGGESTIONS_GUILD_ID = "global";
const SUGGESTIONS_CHANNEL_ID = "x";
const RECOVERY_BACKUP_FILENAME =
  "game_documents.sqlite.bak.2026-08-31T03-09-56-930Z";
const RECOVERY_MARKER_FILENAME =
  "migration-suggestion-recovery-2026-08-31.complete.json";

function consolidateGlobalSuggestions(store) {
  const documents = store.getDocumentsByCollection("suggest");
  const suggestions = [];
  const suggestionIds = new Set();
  let duplicateCount = 0;
  let sourceDocumentCount = 0;

  for (const document of documents) {
    if (document.guildId !== GLOBAL_SUGGESTIONS_GUILD_ID) {
      sourceDocumentCount++;
    }

    const documentSuggestions = Array.isArray(document.data?.suggestions)
      ? document.data.suggestions
      : [];
    for (const suggestion of documentSuggestions) {
      if (suggestion?.id && suggestionIds.has(suggestion.id)) {
        duplicateCount++;
        continue;
      }

      if (suggestion?.id) {
        suggestionIds.add(suggestion.id);
      }
      suggestions.push(suggestion);
    }
  }

  store.upsertGameData(
    GLOBAL_SUGGESTIONS_GUILD_ID,
    "suggest",
    SUGGESTIONS_CHANNEL_ID,
    { suggestions }
  );

  return {
    sourceDocumentCount,
    globalDocumentFound: documents.some(
      (document) => document.guildId === GLOBAL_SUGGESTIONS_GUILD_ID
    ),
    suggestionsKept: suggestions.length,
    duplicateCount,
  };
}

function validateRecoveryBackup(backupPath) {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Recovery backup does not exist: ${backupPath}`);
  }

  const backup = new Database(backupPath, { readonly: true });
  try {
    const table = backup
      .query(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'game_documents'`
      )
      .get();
    if (!table) {
      throw new Error(`Recovery backup has no game_documents table: ${backupPath}`);
    }

    return backup
      .query(
        `SELECT collection, COUNT(*) AS count
         FROM game_documents
         GROUP BY collection
         ORDER BY collection`
      )
      .all();
  } finally {
    backup.close();
  }
}

function writeRecoveryMarker(markerPath, recoveryBackupPath) {
  const temporaryMarkerPath = `${markerPath}.${process.pid}.tmp`;
  fs.writeFileSync(
    temporaryMarkerPath,
    JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        recoveryBackupPath,
      },
      null,
      2
    )
  );
  fs.renameSync(temporaryMarkerPath, markerPath);
}

function formatSuggestionRecoverySummary(result) {
  const lines = [`Suggestion recovery migration: ${result.status}.`];
  lines.push(`Current database backup: ${result.currentBackupPath}`);

  if (result.status === "already completed") {
    lines.push(`Completion marker: ${result.markerPath}`);
    return lines.join("\n");
  }

  lines.push(`Recovery source: ${result.recoveryBackupPath}`);
  for (const row of result.restoredCounts) {
    lines.push(`${row.collection}: ${row.count} restored from backup`);
  }
  lines.push(
    `suggestions: ${result.suggestions.sourceDocumentCount} server document(s) scanned, ${result.suggestions.suggestionsKept} kept, ${result.suggestions.duplicateCount} duplicate(s) skipped`
  );
  lines.push(`Completion marker: ${result.markerPath}`);
  return lines.join("\n");
}

function runSuggestionRecoveryMigration({
  store,
  dataDir = ensureDataDir(),
} = {}) {
  const gameStore = store ?? new GameStore();
  const currentBackupPath = gameStore.createBackup();
  const recoveryBackupPath = path.join(dataDir, RECOVERY_BACKUP_FILENAME);
  const markerPath = path.join(dataDir, RECOVERY_MARKER_FILENAME);

  if (fs.existsSync(markerPath)) {
    const result = {
      status: "already completed",
      currentBackupPath,
      markerPath,
    };
    return { ...result, summary: formatSuggestionRecoverySummary(result) };
  }

  const restoredCounts = validateRecoveryBackup(recoveryBackupPath);
  let replacementStarted = false;
  try {
    replacementStarted = true;
    gameStore.restoreFromBackup(recoveryBackupPath);
    const suggestions = consolidateGlobalSuggestions(gameStore);
    writeRecoveryMarker(markerPath, recoveryBackupPath);

    const result = {
      status: "completed",
      currentBackupPath,
      recoveryBackupPath,
      markerPath,
      restoredCounts,
      suggestions,
    };
    return { ...result, summary: formatSuggestionRecoverySummary(result) };
  } catch (error) {
    if (replacementStarted) {
      try {
        gameStore.restoreFromBackup(currentBackupPath);
      } catch (rollbackError) {
        error.message = `${error.message}; rollback failed: ${rollbackError.message}`;
      }
    }
    throw error;
  }
}

module.exports = {
  consolidateGlobalSuggestions,
  runSuggestionRecoveryMigration,
  formatSuggestionRecoverySummary,
  RECOVERY_BACKUP_FILENAME,
  RECOVERY_MARKER_FILENAME,
};
