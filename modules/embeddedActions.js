"use strict";

const { cloneDeep } = require("lodash");
const GameDB = require("../db/anygame");
const GameHelper = require("./GlobalGameHelper");
const GameStatusHelper = require("./GameStatusHelper");
const CardMoves = require("./cardMoves");
const {
  ACTION_COUNT_MAX,
  ACTION_COUNT_MIN,
  parseActionCount,
} = require("./actionCount");
const {
  GAME_COLLECTION,
  isMissingGame,
  resolveGetGameData,
  resolvePlayerDisplays,
  snapshotFromGameData,
  userIsPlayer,
} = require("./embeddedGames");

const VISUAL_ACTIONS = new Set(["deal", "draw"]);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const ACTION_ERROR_MESSAGES = Object.freeze({
  access_unverified: "Could not verify access to that channel.",
  action_failed: "Could not run that action.",
  channel_mismatch: "That game doesn't belong to this server.",
  forbidden: "You don't have access to that channel.",
  invalid_action: "That action isn't available.",
  invalid_count: `Enter a whole number from ${ACTION_COUNT_MIN} to ${ACTION_COUNT_MAX}.`,
  missing_channel: "Missing channel.",
  missing_deck: "Choose a deck first.",
  missing_guild: "Missing server.",
  no_cards_in_draw: "No cards in draw pile",
  no_cards_to_deal: "No cards to deal.",
  no_game: "No game for that channel.",
  not_a_player: "You're not a player in this game.",
  unauthorized: "Could not confirm your Discord account.",
  unknown_deck: "Unknown deck.",
  unspecified_deck: GameHelper.SPECIFY_DECK_MESSAGE,
});

function visualActionErrorMessage(error, fallback) {
  const code = String(error || "").trim();
  if (code && ACTION_ERROR_MESSAGES[code]) return ACTION_ERROR_MESSAGES[code];
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  return ACTION_ERROR_MESSAGES.action_failed;
}

function errorBody(error, status, fallback) {
  return {
    status,
    body: { error, message: visualActionErrorMessage(error, fallback) },
  };
}

function parseVisualActionRequestId(value) {
  const id = String(value || "").trim();
  if (!REQUEST_ID_PATTERN.test(id)) return null;
  return id;
}

function displayNameFromDiscordUser(user) {
  if (!user || typeof user !== "object") return null;
  for (const value of [user.global_name, user.username]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function displayNameFromGuildMember(member) {
  if (!member || typeof member !== "object") return null;
  for (const value of [member.nick, member.displayName, member.nickname]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return displayNameFromDiscordUser(member.user);
}

function parseVisualActionBody(body = {}) {
  const action = String(body.action || "").trim().toLowerCase();
  if (!VISUAL_ACTIONS.has(action)) {
    return {
      error: "invalid_action",
      status: 400,
      message: "Deal and Draw are the only visual actions.",
    };
  }
  const deckName = typeof body.deck === "string" ? body.deck.trim() : "";
  if (!deckName) {
    return { error: "missing_deck", status: 400, message: "Pick a deck first." };
  }
  const count = parseActionCount(body.count);
  if (count == null) {
    return {
      error: "invalid_count",
      status: 400,
      message: ACTION_ERROR_MESSAGES.invalid_count,
    };
  }
  return {
    action,
    deckName,
    count,
    requestId: parseVisualActionRequestId(body.requestId),
  };
}

function actorFromDiscordUser(user, member) {
  const displayName =
    displayNameFromGuildMember(member) ||
    displayNameFromDiscordUser(user) ||
    (typeof user?.username === "string" ? user.username.trim() : "") ||
    "Player";
  const username =
    (typeof user?.username === "string" && user.username.trim()) || displayName;
  return {
    id: user?.id,
    username,
    displayName,
  };
}

function findPlayer(gameData, userId) {
  const uid = String(userId || "");
  if (!uid || !Array.isArray(gameData?.players)) return null;
  return gameData.players.find((player) => String(player?.userId) === uid) || null;
}

function ensurePlayer(gameData, { userId, guildId, displayName }) {
  const existing = findPlayer(gameData, userId);
  if (existing) return existing;
  if (!Array.isArray(gameData.players)) gameData.players = [];
  gameData.players.push(
    Object.assign({}, cloneDeep(GameDB.defaultPlayer), {
      guildId: String(guildId || ""),
      userId: String(userId),
      order: gameData.players.length + 1,
      name: displayName,
    })
  );
  return findPlayer(gameData, userId);
}

async function resolveDiscordChannel(discordClient, channelId) {
  const id = String(channelId || "").trim();
  if (!discordClient || !id) return null;
  try {
    const cached = discordClient.channels?.cache?.get?.(id);
    if (cached) return cached;
    if (typeof discordClient.channels?.fetch === "function") {
      return await discordClient.channels.fetch(id);
    }
  } catch {
    return null;
  }
  return null;
}

async function persistGameData({
  discordClient,
  gameStore,
  guildId,
  channelId,
  gameData,
}) {
  if (typeof discordClient?.setGameDataV2 === "function") {
    await discordClient.setGameDataV2(guildId, GAME_COLLECTION, channelId, gameData);
    return;
  }
  if (typeof gameStore?.upsertGameData === "function") {
    gameStore.upsertGameData(guildId, GAME_COLLECTION, channelId, gameData);
  }
}

async function postCommandToGameChannel({
  discordClient,
  guildId,
  channelId,
  actor,
  gameData,
  content,
  logger,
}) {
  if (!discordClient) return false;
  const channel = await resolveDiscordChannel(discordClient, channelId);
  if (!channel) {
    logger?.log?.(
      `Visual-mode action could not resolve Discord channel ${channelId}`,
      "warn"
    );
    return false;
  }
  const interaction = {
    guildId,
    channelId,
    channel,
    user: { id: actor.id, username: actor.username },
    member: { displayName: actor.displayName, user: { id: actor.id } },
    deferred: false,
    replied: false,
  };
  await GameStatusHelper.sendPublicStatusUpdate(
    interaction,
    discordClient,
    gameData,
    { content }
  );
  return true;
}

function applyVisualCardAction(gameData, { action, deckName, count, actor, userId }) {
  const deckResult = GameHelper.resolveDeckOption(gameData, deckName);
  if (deckResult.unspecified) {
    return {
      ok: false,
      status: 409,
      error: "unspecified_deck",
      content: GameHelper.SPECIFY_DECK_MESSAGE,
    };
  }
  const deck = deckResult.deck;
  if (!deck) {
    return { ok: false, status: 404, error: "unknown_deck", content: "Unknown deck." };
  }

  if (action === "deal") {
    const result = CardMoves.dealMultiple(gameData, { deck, count, actor });
    if (!result.ok) {
      return { ok: false, status: 409, error: result.error, content: result.content };
    }
    return { ok: true, content: result.content };
  }

  const player = findPlayer(gameData, userId);
  const result = CardMoves.drawMultiple(gameData, {
    deck,
    count,
    actor,
    player,
  });
  if (!result.ok) {
    const status = result.error === "not_a_player" ? 403 : 409;
    return { ok: false, status, error: result.error, content: result.content };
  }
  return { ok: true, content: result.content };
}

function createActionIdempotencyCache({ ttlMs = 5 * 60 * 1000 } = {}) {
  const completed = new Map();
  const inflight = new Map();

  function cacheKey(userId, guildId, channelId, requestId) {
    return `${userId}:${guildId}:${channelId}:${requestId}`;
  }

  async function run(requestId, userId, guildId, channelId, fn) {
    const id = parseVisualActionRequestId(requestId);
    if (!id) return fn();
    const key = cacheKey(userId, guildId, channelId, id);
    const cached = completed.get(key);
    if (cached) return cached;
    if (inflight.has(key)) return inflight.get(key);
    const promise = Promise.resolve()
      .then(fn)
      .then((result) => {
        inflight.delete(key);
        if (result?.status === 200) {
          completed.set(key, result);
          setTimeout(() => completed.delete(key), ttlMs).unref?.();
        }
        return result;
      })
      .catch((err) => {
        inflight.delete(key);
        throw err;
      });
    inflight.set(key, promise);
    return promise;
  }

  return { run };
}

async function snapshotFromCurrentGame({
  gameData,
  discordClient,
  guildId,
  channelId,
  userId,
}) {
  const userIds = Array.isArray(gameData?.players)
    ? gameData.players.map((player) => String(player?.userId || "")).filter(Boolean)
    : [];
  const playerDisplays = await resolvePlayerDisplays({
    discordClient,
    guildId,
    userIds,
  });
  return snapshotFromGameData(gameData, {
    channelId,
    guildId,
    userId,
    playerDisplays,
  });
}

async function runVisualCardAction({
  action,
  deckName,
  count,
  user,
  member,
  guildId,
  channelId,
  getGameData,
  discordClient,
  gameStore,
  logger,
  requestId,
  idempotency,
} = {}) {
  const gid = String(guildId || "").trim();
  const cid = String(channelId || "").trim();
  const uid = String(user?.id || "").trim();
  if (!gid) return errorBody("missing_guild", 400);
  if (!cid) return errorBody("missing_channel", 400);
  if (!uid) return errorBody("unauthorized", 401);

  const execute = () =>
    runVisualCardActionOnce({
      action,
      deckName,
      count,
      user,
      member,
      guildId: gid,
      channelId: cid,
      userId: uid,
      getGameData,
      discordClient,
      gameStore,
      logger,
    });

  if (idempotency && typeof idempotency.run === "function") {
    return idempotency.run(requestId, uid, gid, cid, execute);
  }
  return execute();
}

async function runVisualCardActionOnce({
  action,
  deckName,
  count,
  user,
  member,
  guildId,
  channelId,
  userId,
  getGameData,
  discordClient,
  gameStore,
  logger,
}) {
  const loader = resolveGetGameData({ getGameData, discordClient, gameStore });
  if (!loader) {
    return errorBody("no_game", 404);
  }

  let gameData = null;
  try {
    gameData = await loader(guildId, GAME_COLLECTION, channelId);
  } catch (err) {
    logger?.log?.(
      `Failed to load game for visual-mode action: ${err.message || err}`,
      "error"
    );
    return errorBody("action_failed", 500);
  }

  if (isMissingGame(gameData)) {
    return errorBody("no_game", 404);
  }

  const actor = actorFromDiscordUser(user, member);
  try {
    const displays = await resolvePlayerDisplays({
      discordClient,
      guildId,
      userIds: [userId],
    });
    const guildName = displays[userId]?.name;
    if (typeof guildName === "string" && guildName.trim()) {
      actor.displayName = guildName.trim();
    }
  } catch {
    // OAuth global_name / username / member nick is enough if the lookup fails.
  }
  if (action === "draw" && !userIsPlayer(gameData, userId)) {
    ensurePlayer(gameData, {
      userId,
      guildId,
      displayName: actor.displayName,
    });
  }
  const applied = applyVisualCardAction(gameData, {
    action,
    deckName,
    count,
    actor,
    userId,
  });
  if (!applied.ok) {
    return errorBody(applied.error, applied.status, applied.content);
  }

  try {
    await persistGameData({
      discordClient,
      gameStore,
      guildId,
      channelId,
      gameData,
    });
  } catch (err) {
    logger?.log?.(
      `Failed to save visual-mode action: ${err.message || err}`,
      "error"
    );
    return errorBody("action_failed", 500);
  }

  let channelPosted = false;
  try {
    channelPosted = Boolean(
      await postCommandToGameChannel({
        discordClient,
        guildId,
        channelId,
        actor,
        gameData,
        content: applied.content,
        logger,
      })
    );
  } catch (err) {
    logger?.log?.(
      `Failed to post visual-mode action to Discord: ${err.message || err}`,
      "warn"
    );
    channelPosted = false;
  }

  const snapshotBody = await snapshotFromCurrentGame({
    gameData,
    discordClient,
    guildId,
    channelId,
    userId,
  });
  return {
    status: 200,
    body: {
      ...snapshotBody,
      message: applied.content,
      channelPosted,
    },
  };
}

module.exports = {
  ACTION_ERROR_MESSAGES,
  actorFromDiscordUser,
  applyVisualCardAction,
  createActionIdempotencyCache,
  parseVisualActionBody,
  parseVisualActionRequestId,
  postCommandToGameChannel,
  runVisualCardAction,
  visualActionErrorMessage,
};
