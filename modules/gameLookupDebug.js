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

function formatGameLookup(inspection) {
  const rows = (inspection.channelRows || []).map(formatStoredRow).join(" || ") || "none";
  return `db=${inspection.dbPath} guildGames=${inspection.guildGameCount} exact=${formatStoredRow(inspection.exact)} channelRows=${rows}`;
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
  formatGameLookup,
  logMoneyGameMiss,
  summarizeRawGame,
};
