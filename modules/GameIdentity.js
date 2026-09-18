const { EmbedBuilder } = require("discord.js");

const CUSTOM_NAME_MIN_LENGTH = 1;
const CUSTOM_NAME_MAX_LENGTH = 100;
const CUSTOM_GAME_LABEL = "Custom game";
const BOTH_OPTIONS_ERROR = "Pick BGG or custom name, not both";
const MISSING_IDENTITY_ERROR = "Provide a BGG game or a custom name.";
const INVALID_BGG_ERROR = "Please provide a game name or ID from the available options.";
const INVALID_CUSTOM_ERROR = `Custom game name must be ${CUSTOM_NAME_MIN_LENGTH}-${CUSTOM_NAME_MAX_LENGTH} characters.`;

function hasProvidedString(value) {
  return value != null && String(value) !== "";
}

function normalizeCustomName(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * Resolve BGG xor custom game identity from slash options.
 * Shared by /game newgame, /lfg, and LFG Start game persistence.
 * Exactly one of BGG `game` (numeric id) or `customname` is allowed.
 */
function resolveGameIdentity({ game, customname } = {}) {
  const hasGame = hasProvidedString(game);
  const hasCustom = hasProvidedString(customname);

  if (hasGame && hasCustom) {
    return { error: BOTH_OPTIONS_ERROR };
  }

  if (hasCustom) {
    const name = normalizeCustomName(customname);
    if (name.length < CUSTOM_NAME_MIN_LENGTH || name.length > CUSTOM_NAME_MAX_LENGTH) {
      return { error: INVALID_CUSTOM_ERROR };
    }
    return { kind: "custom", name };
  }

  if (!hasGame || Number.isNaN(Number(game))) {
    return { error: hasGame ? INVALID_BGG_ERROR : MISSING_IDENTITY_ERROR };
  }

  return { kind: "bgg", bggGameId: String(game) };
}

const resolveNewGameIdentity = resolveGameIdentity;

function applyCustomGameIdentity(gameData, name) {
  gameData.isCustomGame = true;
  gameData.bggGameId = null;
  gameData.name = name;
}

function applyBggGameIdentity(gameData, bggGameId) {
  gameData.isCustomGame = false;
  gameData.bggGameId = String(bggGameId);
}

/**
 * Apply FUR-91 session metadata from a gather's stored game snapshot.
 * Custom gathers set isCustomGame + null bggGameId + the custom name.
 */
function applyIdentityFromGather(gameData, gatherGame) {
  if (gatherGame?.isCustom) {
    applyCustomGameIdentity(gameData, gatherGame.customName || gatherGame.name);
    return;
  }
  gameData.isCustomGame = false;
  gameData.bggGameId = gatherGame?.bggId ? String(gatherGame.bggId) : null;
}

function isCustomGame(gameData) {
  return Boolean(gameData?.isCustomGame);
}

function statusGameLabel(gameData) {
  const name = gameData?.name || "Game";
  if (isCustomGame(gameData)) {
    return `${name} (${CUSTOM_GAME_LABEL})`;
  }
  return name;
}

function buildCustomGameCreateEmbed(name) {
  return new EmbedBuilder()
    .setColor(13502711)
    .setTitle(name)
    .setDescription(`${CUSTOM_GAME_LABEL} — not on BoardGameGeek`);
}

module.exports = {
  CUSTOM_NAME_MIN_LENGTH,
  CUSTOM_NAME_MAX_LENGTH,
  CUSTOM_GAME_LABEL,
  BOTH_OPTIONS_ERROR,
  MISSING_IDENTITY_ERROR,
  INVALID_BGG_ERROR,
  INVALID_CUSTOM_ERROR,
  resolveGameIdentity,
  resolveNewGameIdentity,
  applyCustomGameIdentity,
  applyBggGameIdentity,
  applyIdentityFromGather,
  isCustomGame,
  statusGameLabel,
  buildCustomGameCreateEmbed,
};
