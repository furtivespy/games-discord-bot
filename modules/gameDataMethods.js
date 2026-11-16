const { trace, SpanStatusCode } = require("@opentelemetry/api");
const _ = require("lodash");
const GameStatusHelper = require("./GameStatusHelper");
const { formatGameLookup } = require("./gameLookupDebug.js");

function getGameData(gameName) {
  const guildData = this.gamedata.get(gameName);
  return guildData || null;
}

function _warnIfGameLookupLooksWrong(serverId, gameName, channelId, source, result, err) {
  if (gameName !== "game" || typeof this.db?.inspectGameLookup !== "function") return;
  const failed =
    !!err ||
    result == null ||
    result.isdeleted === true ||
    (result.isdeleted == null && result.name == null && result.players == null);
  if (!failed) return;

  let inspection;
  try {
    inspection = this.db.inspectGameLookup(serverId, gameName, channelId);
  } catch (inspectErr) {
    this.logger?.warn?.(
      `[game-lookup] source=${source} guild=${serverId} channel=${channelId} inspect-failed ${inspectErr.message} loadError=${err?.message || ""}`
    );
    return;
  }

  const exact = inspection.exact;
  const otherGameGuild = (inspection.channelRows || []).some(
    (row) => row.collection === gameName && String(row.guildId) !== String(serverId)
  );
  const storedActive = exact && !exact.parseError && exact.isdeleted === false;
  const emptyDb = inspection.guildGameCount === 0;
  if (!(storedActive || otherGameGuild || emptyDb || err || exact?.parseError)) return;

  const returned = result
    ? `isdeleted=${result.isdeleted} name=${JSON.stringify(result.name ?? null)}`
    : "null";
  this.logger?.warn?.(
    `[game-lookup] source=${source} guild=${serverId} channel=${channelId} returned=${returned} loadError=${err?.message || ""} ${formatGameLookup(inspection)}`
  );
}

async function getGameDataV2(serverId, gameName, channelId) {
  const tracer = trace.getTracer("discord-bot");
  return tracer.startActiveSpan("game.load", async (span) => {
    span.setAttribute("game.collection", gameName);
    try {
      let guildData = this.db.getSpecificGameData(serverId, gameName, channelId);
      if (!_.isEmpty(guildData)) {
        const result = this.migrateGameData(guildData);
        span.setAttributes({
          "game.found": true,
          "game.player_count": result?.players?.length ?? 0,
        });
        this._warnIfGameLookupLooksWrong(serverId, gameName, channelId, "sqlite", result, null);
        return result;
      }
      guildData = await this.getGameData(`${gameName}-${channelId}`);
      const result = this.migrateGameData(guildData);
      span.setAttributes({
        "game.found": !_.isEmpty(guildData),
        "game.player_count": result?.players?.length ?? 0,
      });
      this._warnIfGameLookupLooksWrong(serverId, gameName, channelId, "legacy", result, null);
      return result;
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      this._warnIfGameLookupLooksWrong(serverId, gameName, channelId, "error", null, err);
      throw err;
    } finally {
      span.end();
    }
  });
}

// Migrate legacy game data to ensure all required properties exist
function migrateGameData(gameData) {
  if (!gameData) return gameData;

  // Check if this is an empty object or has no meaningful data
  // Don't migrate empty objects - they're not real games
  const hasData = Object.keys(gameData).length > 0 && (
    gameData.players !== undefined ||
    gameData.name !== undefined ||
    gameData.decks !== undefined ||
    gameData.tokens !== undefined
  );

  if (!hasData) {
    // This is an empty object from a "no game found" query, don't migrate it
    return gameData;
  }

  // Ensure isdeleted exists - legacy games that exist should be active
  if (gameData.isdeleted === undefined) {
    gameData.isdeleted = false;
  }

  // Ensure players array exists
  if (gameData.players === undefined) {
    gameData.players = [];
  }

  // Ensure decks array exists
  if (gameData.decks === undefined) {
    gameData.decks = [];
  }

  // Ensure tokens array exists
  if (gameData.tokens === undefined) {
    gameData.tokens = [];
  }

  // Ensure customDice array exists
  if (gameData.customDice === undefined) {
    gameData.customDice = [];
  }

  // Ensure history array exists
  if (gameData.history === undefined) {
    gameData.history = [];
  }

  // Ensure playToPlayArea exists
  if (gameData.playToPlayArea === undefined) {
    gameData.playToPlayArea = false;
  }

  // Ensure reverseOrder exists
  if (gameData.reverseOrder === undefined) {
    gameData.reverseOrder = false;
  }

  // Ensure name exists
  if (gameData.name === undefined) {
    gameData.name = "";
  }

  // Ensure winner exists
  if (gameData.winner === undefined) {
    gameData.winner = null;
  }
  if (gameData.winnerPortrait === undefined) {
    gameData.winnerPortrait = null;
  }

  // Ensure lastStatusMessage fields exist
  if (gameData.lastStatusMessageId === undefined) {
    gameData.lastStatusMessageId = null;
  }
  if (gameData.lastStatusMessageTimestamp === undefined) {
    gameData.lastStatusMessageTimestamp = null;
  }

  // Ensure pinned live status fields exist (feature defaults to off).
  // Prefer pinnedStatusMode; derive from the legacy boolean when missing.
  // Do not overwrite an already-migrated mode, and do not delete the old flag.
  GameStatusHelper.applyPinnedStatusModeDefaults(gameData);
  if (gameData.pinnedStatusMessageId === undefined) {
    gameData.pinnedStatusMessageId = null;
  }
  if (gameData.pinnedStatusChannelId === undefined) {
    gameData.pinnedStatusChannelId = null;
  }
  if (gameData.pinnedStatusPinned === undefined) {
    gameData.pinnedStatusPinned = false;
  }

  return gameData;
}

module.exports = {
  getGameData,
  getGameDataV2,
  migrateGameData,
  _warnIfGameLookupLooksWrong,
};
