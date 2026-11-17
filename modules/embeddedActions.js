"use strict";

const { cloneDeep } = require("lodash");
const GameDB = require("../db/anygame");
const GameHelper = require("./GlobalGameHelper");
const GameStatusHelper = require("./GameStatusHelper");
const CardMoves = require("./cardMoves");
const { parseActionCount } = require("./actionCount");
const {
  ACTION_ERROR_MESSAGES: SHARED_ACTION_ERROR_MESSAGES,
} = require("./visualActionShared.json");
const {
  GAME_COLLECTION,
  isMissingGame,
  resolveGetGameData,
  resolvePlayerDisplays,
  snapshotFromGameData,
  snapshotVersion,
  userIsPlayer,
} = require("./embeddedGames");

const VISUAL_ACTIONS = new Set(["deal", "draw"]);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const ACTION_IDEMPOTENCY_MAX = 500;
const ACTION_ERROR_MESSAGES = Object.freeze({
  ...SHARED_ACTION_ERROR_MESSAGES,
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
      message: ACTION_ERROR_MESSAGES.invalid_action,
    };
  }
  const deckName = typeof body.deck === "string" ? body.deck.trim() : "";
  if (!deckName) {
    return {
      error: "missing_deck",
      status: 400,
      message: ACTION_ERROR_MESSAGES.missing_deck,
    };
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
    await discordClient.setGameDataV2(guildId, GAME_COLLECTION, channelId, gameData, {
      skipPinnedRefresh: true,
    });
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

/**
 * Serialize load → mutate → save for one game document. Two Deal/Draw POSTs
 * with different requestIds must not both load the same snapshot. The Discord
 * channel post stays on this lock so persistStatusUpdate cannot clobber a
 * later save. The HTTP response is released as soon as persist finishes.
 */
function createGameChannelLock() {
  const tails = new Map();

  function run(guildId, channelId, fn) {
    const key = `${guildId}:${channelId}`;
    const previous = tails.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(fn);
    const idle = next.then(
      () => {},
      () => {}
    );
    tails.set(key, idle);
    idle.then(() => {
      if (tails.get(key) === idle) tails.delete(key);
    });
    return next;
  }

  return { run };
}

const defaultGameChannelLock = createGameChannelLock();
const pendingLockedVisualActions = new Set();

function trackLockedVisualAction(work) {
  const promise = Promise.resolve()
    .then(work)
    .catch(() => false);
  pendingLockedVisualActions.add(promise);
  promise.finally(() => pendingLockedVisualActions.delete(promise));
  return promise;
}

async function drainLockedVisualActions() {
  while (pendingLockedVisualActions.size > 0) {
    await Promise.all([...pendingLockedVisualActions]);
  }
}

async function enrichActorDisplayName(actor, { discordClient, guildId, userId }) {
  try {
    const displays = await resolvePlayerDisplays({
      discordClient,
      guildId,
      userIds: [userId],
      fetchMissing: false,
    });
    const guildName = displays[userId]?.name;
    if (typeof guildName === "string" && guildName.trim()) {
      actor.displayName = guildName.trim();
    }
  } catch {
    // OAuth global_name / username / member nick is enough if the cache misses.
  }
}

/**
 * Per-process in-memory TTL map. A second instance still runs the same
 * requestId. The key includes action, deck, and count so a reused id for a
 * different Deal/Draw is not swallowed.
 */
function createActionIdempotencyCache({
  ttlMs = 5 * 60 * 1000,
  maxSize = ACTION_IDEMPOTENCY_MAX,
} = {}) {
  const completed = new Map();
  const inflight = new Map();

  function cacheKey(userId, guildId, channelId, requestId, action, deckName, count) {
    return `${userId}:${guildId}:${channelId}:${requestId}:${action}:${deckName}:${count}`;
  }

  function remember(key, result) {
    if (completed.size >= maxSize && !completed.has(key)) {
      const oldest = completed.keys().next().value;
      if (oldest != null) completed.delete(oldest);
    }
    completed.set(key, result);
    setTimeout(() => completed.delete(key), ttlMs).unref?.();
  }

  async function run(requestId, userId, guildId, channelId, fn, actionParts = {}) {
    const id = parseVisualActionRequestId(requestId);
    if (!id) return fn();
    const action = String(actionParts.action || "");
    const deckName = String(actionParts.deckName || "");
    const count = String(actionParts.count ?? "");
    const key = cacheKey(userId, guildId, channelId, id, action, deckName, count);
    const cached = completed.get(key);
    if (cached) return cached;
    if (inflight.has(key)) return inflight.get(key);
    const promise = Promise.resolve()
      .then(fn)
      .then((result) => {
        inflight.delete(key);
        if (result?.status === 200) {
          remember(key, result);
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

  return { run, size: () => completed.size };
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
    fetchMissing: false,
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
  gameChannelLock,
} = {}) {
  const gid = String(guildId || "").trim();
  const cid = String(channelId || "").trim();
  const uid = String(user?.id || "").trim();
  if (!gid) return errorBody("missing_guild", 400);
  if (!cid) return errorBody("missing_channel", 400);
  if (!uid) return errorBody("unauthorized", 401);

  const actor = actorFromDiscordUser(user, member);
  await enrichActorDisplayName(actor, {
    discordClient,
    guildId: gid,
    userId: uid,
  });

  const lock =
    gameChannelLock && typeof gameChannelLock.run === "function"
      ? gameChannelLock
      : defaultGameChannelLock;

  const execute = () => {
    let releaseHttp;
    const httpReady = new Promise((resolve, reject) => {
      releaseHttp = { resolve, reject };
    });
    trackLockedVisualAction(() =>
      lock.run(gid, cid, async () => {
        try {
          const persisted = await runVisualCardActionOnce({
            action,
            deckName,
            count,
            actor,
            guildId: gid,
            channelId: cid,
            userId: uid,
            getGameData,
            discordClient,
            gameStore,
            logger,
          });
          if (persisted.status !== 200) {
            releaseHttp.resolve(persisted);
            return persisted;
          }
          const snapshotBody = await snapshotFromCurrentGame({
            gameData: persisted.gameData,
            discordClient,
            guildId: gid,
            channelId: cid,
            userId: uid,
          });
          const version = snapshotVersion(persisted.gameData, {
            channelId: cid,
            guildId: gid,
            userId: uid,
          });
          releaseHttp.resolve({
            status: 200,
            version,
            body: {
              ...snapshotBody,
              version,
              message: persisted.applied.content,
            },
          });
          let posted = false;
          try {
            posted = Boolean(
              await postCommandToGameChannel({
                discordClient,
                guildId: gid,
                channelId: cid,
                actor,
                gameData: persisted.gameData,
                content: persisted.applied.content,
                logger,
              })
            );
          } catch (err) {
            logger?.log?.(
              `Failed to post visual-mode action to Discord: ${err.message || err}`,
              "warn"
            );
            posted = false;
          }
          if (!posted) {
            try {
              await GameStatusHelper.refreshPinnedStatusAfterGameSave(
                discordClient,
                { guildId: gid, channelId: cid },
                persisted.gameData
              );
            } catch (err) {
              logger?.log?.(
                `Pinned status refresh after visual-mode action failed: ${err.message || err}`,
                "warn"
              );
            }
          }
          return posted;
        } catch (err) {
          releaseHttp.reject(err);
          throw err;
        }
      })
    );
    return httpReady;
  };

  if (idempotency && typeof idempotency.run === "function") {
    return idempotency.run(requestId, uid, gid, cid, execute, {
      action,
      deckName,
      count,
    });
  }
  return execute();
}

async function runVisualCardActionOnce({
  action,
  deckName,
  count,
  actor,
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

  return { status: 200, gameData, applied };
}

module.exports = {
  ACTION_ERROR_MESSAGES,
  ACTION_IDEMPOTENCY_MAX,
  actorFromDiscordUser,
  applyVisualCardAction,
  createActionIdempotencyCache,
  createGameChannelLock,
  drainLockedVisualActions,
  parseVisualActionBody,
  parseVisualActionRequestId,
  postCommandToGameChannel,
  runVisualCardAction,
  visualActionErrorMessage,
};
