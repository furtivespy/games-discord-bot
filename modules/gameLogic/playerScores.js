"use strict";

const GameDB = require("../../db/anygame.js");
const GameHelper = require("../GlobalGameHelper");

const SCOREALL_UPDATED_CONTENT = "Player scores updated successfully.";
// Discord Short text inputs (scoreall modal) cap at 4000; visual inputs match.
const SCORE_MAX_LENGTH = 4000;

function actorDisplayName(actor, fallback) {
  const explicit =
    typeof fallback === "string" && fallback.trim() ? fallback.trim() : "";
  if (explicit) return explicit;
  const display =
    typeof actor?.displayName === "string" && actor.displayName.trim()
      ? actor.displayName.trim()
      : "";
  if (display) return display;
  const username =
    typeof actor?.username === "string" && actor.username.trim()
      ? actor.username.trim()
      : "";
  return username || "Player";
}

function recordActor(actor) {
  const username =
    typeof actor?.username === "string" && actor.username.trim()
      ? actor.username
      : actorDisplayName(actor);
  return {
    id: actor?.id,
    username,
  };
}

function playerNameFromMap(player, playerNames) {
  const id = String(player?.userId || "");
  const mapped =
    playerNames && typeof playerNames === "object"
      ? playerNames[id] || playerNames[player?.userId]
      : null;
  if (typeof mapped === "string" && mapped.trim()) return mapped.trim();
  if (typeof player?.name === "string" && player.name.trim()) {
    return player.name.trim();
  }
  return id ? `Player ${id}` : "Player";
}

function findPlayer(gameData, userId) {
  const uid = String(userId || "");
  if (!uid || !Array.isArray(gameData?.players)) return null;
  return (
    gameData.players.find((player) => String(player?.userId) === uid) || null
  );
}

function isNonFiniteScoreText(text) {
  const trimmed = String(text).trim();
  if (!trimmed) return false;
  if (/^[+-]?(nan|infinity)$/i.test(trimmed)) return true;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return false;
  return !Number.isFinite(Number(trimmed));
}

/**
 * Coerce a score to the string slash/modal/visual all store.
 * Non-finite numbers, NaN/Infinity text, and oversized values become ""
 * (skipped by scoreall / visual Save, same as an empty field).
 */
function scoreValue(value) {
  if (value == null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  const text = String(value);
  if (text.length > SCORE_MAX_LENGTH) return "";
  if (isNonFiniteScoreText(text)) return "";
  return text;
}

function rawScoreFromMap(updates, player) {
  const id = String(player?.userId || "");
  if (Object.prototype.hasOwnProperty.call(updates, id)) return updates[id];
  if (Object.prototype.hasOwnProperty.call(updates, player?.userId)) {
    return updates[player.userId];
  }
  return undefined;
}

/**
 * `/players score`: set one seated player's score string and record history.
 * Callers persist and format the Discord reply.
 */
function setPlayerScore(
  gameData,
  {
    targetUserId,
    score,
    actor,
    actorDisplayName: actorName,
    targetDisplayName,
    targetUsername,
  } = {}
) {
  const player = findPlayer(gameData, targetUserId);
  if (!player) {
    return { ok: false, error: "not_a_player", player: null };
  }

  const newScore = scoreValue(score);
  const oldScore = player.score;
  player.score = newScore;

  const displayName = actorDisplayName(actor, actorName);
  const targetName =
    (typeof targetDisplayName === "string" && targetDisplayName.trim()
      ? targetDisplayName.trim()
      : "") ||
    (typeof targetUsername === "string" && targetUsername.trim()
      ? targetUsername.trim()
      : "") ||
    playerNameFromMap(player);

  try {
    GameHelper.recordMove(
      gameData,
      recordActor(actor),
      GameDB.ACTION_CATEGORIES.PLAYER,
      GameDB.ACTION_TYPES.SCORE,
      `${displayName} set ${targetName}'s score to ${newScore}${
        oldScore ? ` (was ${oldScore})` : ""
      }`,
      {
        targetPlayer: {
          userId: String(targetUserId),
          username:
            typeof targetUsername === "string" && targetUsername.trim()
              ? targetUsername
              : targetName,
        },
        oldScore,
        newScore,
      },
      displayName
    );
  } catch (error) {
    console.warn("Failed to record score change action in history:", error);
  }

  return { ok: true, error: null, player, oldScore, newScore };
}

/**
 * `/players scoreall` modal submit and visual Edit Scores save.
 * Empty / invalid values are skipped; omitted ids are left untouched;
 * unchanged values are skipped; one history entry covers every change.
 * Callers persist only when `changed` is true. `recordMove` is not caught:
 * a history failure must not look like a successful scoreall submit.
 */
function applyPlayerScores(
  gameData,
  { scores, actor, actorDisplayName: actorName, playerNames } = {}
) {
  const updates =
    scores && typeof scores === "object" && !Array.isArray(scores) ? scores : {};
  const players = Array.isArray(gameData?.players) ? gameData.players : [];
  const changes = [];

  for (const player of players) {
    const id = String(player?.userId || "");
    if (!id) continue;
    if (
      !Object.prototype.hasOwnProperty.call(updates, id) &&
      !Object.prototype.hasOwnProperty.call(updates, player.userId)
    ) {
      continue;
    }
    const newScore = scoreValue(rawScoreFromMap(updates, player));
    if (newScore && player.score !== newScore) {
      const oldScore = player.score;
      player.score = newScore;
      changes.push({
        playerName: playerNameFromMap(player, playerNames),
        oldScore,
        newScore,
      });
    }
  }

  if (changes.length > 0) {
    const displayName = actorDisplayName(actor, actorName);
    let historyMessage = `${displayName} updated player scores:\n`;
    historyMessage += changes
      .map(
        (change) =>
          `${change.playerName}'s score changed from ${change.oldScore || "0"} to ${change.newScore}`
      )
      .join("\n");

    GameHelper.recordMove(
      gameData,
      recordActor(actor),
      GameDB.ACTION_CATEGORIES.PLAYER,
      GameDB.ACTION_TYPES.SCORE,
      historyMessage,
      { changes }
    );
  }

  return {
    ok: true,
    error: null,
    changed: changes.length > 0,
    changes,
    content: SCOREALL_UPDATED_CONTENT,
  };
}

module.exports = {
  SCOREALL_UPDATED_CONTENT,
  SCORE_MAX_LENGTH,
  applyPlayerScores,
  scoreValue,
  setPlayerScore,
};
