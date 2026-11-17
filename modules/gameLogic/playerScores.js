"use strict";

const GameDB = require("../../db/anygame.js");
const GameHelper = require("../GlobalGameHelper");

const SCOREALL_UPDATED_CONTENT = "Player scores updated successfully.";

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

function scoreValue(value) {
  if (value == null) return "";
  return String(value);
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
            (typeof targetUsername === "string" && targetUsername.trim()
              ? targetUsername
              : targetName),
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
 * Empty values are skipped; unchanged values are skipped; one history entry
 * covers every change. Callers persist only when `changed` is true.
 */
function applyPlayerScores(
  gameData,
  { scores, actor, actorDisplayName: actorName, playerNames, nameForPlayer } = {}
) {
  const updates = scores && typeof scores === "object" ? scores : {};
  const players = Array.isArray(gameData?.players) ? gameData.players : [];
  const changes = [];

  for (const player of players) {
    const id = String(player?.userId || "");
    if (!id) continue;
    const raw = Object.prototype.hasOwnProperty.call(updates, id)
      ? updates[id]
      : Object.prototype.hasOwnProperty.call(updates, player.userId)
        ? updates[player.userId]
        : "";
    const newScore = scoreValue(raw);
    if (newScore && player.score !== newScore) {
      const oldScore = player.score;
      player.score = newScore;
      const playerName =
        typeof nameForPlayer === "function"
          ? nameForPlayer(player, oldScore, newScore)
          : playerNameFromMap(player, playerNames);
      changes.push({ playerName, oldScore, newScore });
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

    try {
      GameHelper.recordMove(
        gameData,
        recordActor(actor),
        GameDB.ACTION_CATEGORIES.PLAYER,
        GameDB.ACTION_TYPES.SCORE,
        historyMessage,
        { changes }
      );
    } catch (error) {
      console.warn("Failed to record score change action in history:", error);
    }
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
  applyPlayerScores,
  setPlayerScore,
};
