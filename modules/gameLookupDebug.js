function summarizeRawGame(rawGameData) {
  if (rawGameData == null) return { present: false };
  return {
    present: true,
    name: rawGameData.name ?? null,
    isdeleted: rawGameData.isdeleted ?? null,
    playerCount: Array.isArray(rawGameData.players) ? rawGameData.players.length : null,
    id: rawGameData.id ?? null,
  };
}

function formatStoredRow(row) {
  if (!row) return "missing";
  const name = JSON.stringify(row.name ?? null);
  const parse = row.parseError ? `parse=${row.parseError}` : "parse=ok";
  return `guild=${row.guildId} collection=${row.collection} name=${name} isdeleted=${row.isdeleted} updated=${row.updatedAt} bytes=${row.dataLength} players=${row.playerCount} bgg=${row.bggGameId ?? ""} ${parse}`;
}

function formatDatabaseFile(label, file) {
  if (!file || file.bytes == null) return `${label}=missing`;
  return `${label}=${file.bytes}@${file.mtime}`;
}

function formatFreshRow(fresh) {
  if (!fresh) return "fresh=skipped";
  const version = `freshDataVersion=${fresh.dataVersion ?? ""}`;
  if (fresh.error && !fresh.exact) return `${version} fresh=error:${fresh.error}`;
  const error = fresh.error ? ` freshError=${fresh.error}` : "";
  return `${version} fresh=${formatStoredRow(fresh.exact)}${error}`;
}

function formatGameLookup(inspection) {
  const rows = (inspection.channelRows || []).map(formatStoredRow).join(" || ") || "none";
  const files = inspection.files || {};
  return [
    `db=${inspection.dbPath}`,
    `journal=${inspection.journalMode ?? "?"}`,
    `pid=${process.pid}`,
    `liveDataVersion=${inspection.liveDataVersion ?? ""}`,
    formatDatabaseFile("main", files.main),
    formatDatabaseFile("wal", files.wal),
    formatDatabaseFile("shm", files.shm),
    `guildGames=${inspection.guildGameCount}`,
    `exact=${formatStoredRow(inspection.exact)}`,
    formatFreshRow(inspection.fresh),
    `channelRows=${rows}`,
  ].join(" ");
}

function gameLookupFailed(result, err) {
  return !!err
    || result == null
    || result.isdeleted === true
    || (result.isdeleted == null && result.name == null && result.players == null);
}

function buildGameLookupWarning({ source, guildId, channelId, result, err, inspection }) {
  if (!gameLookupFailed(result, err)) return null;
  const returned = result
    ? `isdeleted=${result.isdeleted} name=${JSON.stringify(result.name ?? null)}`
    : "null";
  return `[game-lookup] source=${source} guild=${guildId} channel=${channelId} returned=${returned} loadError=${err?.message || ""} ${formatGameLookup(inspection)}`;
}

function logMoneyGameMiss(client, interaction, rawGameData) {
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;
  let inspectionText = "inspect=failed";
  try {
    inspectionText = formatGameLookup(
      client.db.inspectGameLookup(guildId, "game", channelId)
    );
  } catch (err) {
    inspectionText = `inspect=failed:${err.message}`;
  }

  let subcommand = "?";
  try {
    subcommand = interaction.options?.getSubcommand?.() ?? "?";
  } catch {
    subcommand = "?";
  }

  client.logger?.warn?.(
    `[game-lookup] /money ${subcommand} user=${interaction.user?.id ?? "?"} guild=${guildId} channel=${channelId} thread=${Boolean(interaction.channel?.isThread?.())} parent=${interaction.channel?.parentId ?? "?"} raw=${JSON.stringify(summarizeRawGame(rawGameData))} ${inspectionText}`
  );
}

module.exports = {
  buildGameLookupWarning,
  formatGameLookup,
  gameLookupFailed,
  logMoneyGameMiss,
  summarizeRawGame,
};
