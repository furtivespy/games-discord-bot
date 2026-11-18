"use strict";

const { cloneDeep } = require("lodash");
const GameDB = require("../db/anygame");
const GameHelper = require("./GlobalGameHelper");
const GameStatusHelper = require("./GameStatusHelper");
const Formatter = require("./GameFormatter");
const CardMoves = require("./gameLogic/cardMoves");
const PlayerScores = require("./gameLogic/playerScores");
const { parseActionCount } = require("./actionCount");
const {
  ACTION_ERROR_MESSAGES: SHARED_ACTION_ERROR_MESSAGES,
} = require("./visualActionShared.json");
const {
  GAME_COLLECTION,
  isMissingGame,
  resolveGetGameData,
  resolveHostBoardImages,
  resolvePlayerDisplays,
  snapshotFromGameData,
  snapshotVersion,
  userIsPlayer,
} = require("./embeddedGames");
const {
  createGameChannelLock,
  defaultGameChannelLock,
  withGameDocumentLock,
} = require("./gameDocumentLock");

const HAND_ACTIONS = new Set(["play", "discard", "show"]);
const VISUAL_ACTIONS = new Set(["deal", "draw", "scores", "play", "discard", "show"]);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const ACTION_IDEMPOTENCY_MAX = 500;
/** Sequential SHOW of the same card (new requestIds) within this window reuse the first post. */
const SHOW_COALESCE_TTL_MS = 2000;
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

function parseVisualScoreMap(value) {
  const scores = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return scores;
  for (const [userId, score] of Object.entries(value)) {
    const id = String(userId || "").trim();
    if (!id) continue;
    scores[id] = PlayerScores.scoreValue(score);
  }
  return scores;
}

function scoresIdempotencyKey(scores) {
  const map = parseVisualScoreMap(scores);
  return Object.keys(map)
    .sort()
    .map((id) => `${id}=${map[id]}`)
    .join("&");
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
  const requestId = parseVisualActionRequestId(body.requestId);
  if (action === "scores") {
    return {
      action,
      scores: parseVisualScoreMap(body.scores),
      requestId,
    };
  }
  if (HAND_ACTIONS.has(action)) {
    const cardId = typeof body.cardId === "string" ? body.cardId.trim() : "";
    if (!cardId) {
      return {
        error: "missing_card",
        status: 400,
        message: ACTION_ERROR_MESSAGES.missing_card,
      };
    }
    return {
      action,
      cardId,
      requestId,
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
    requestId,
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
  withChannelLock,
  skipPin,
  additionalEmbeds,
  additionalFiles,
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
    {
      content,
      withChannelLock,
      pinFromLatest: true,
      skipPin,
      additionalEmbeds,
      additionalFiles,
    }
  );
  return true;
}

async function cardReplyPartsForChannel(card, logger) {
  if (!card) return { additionalEmbeds: undefined, additionalFiles: undefined };
  try {
    const parts = await Formatter.oneCardReplyParts(card);
    return {
      additionalEmbeds: parts?.embed ? [parts.embed] : undefined,
      additionalFiles: parts?.files?.length ? parts.files : undefined,
    };
  } catch (err) {
    logger?.log?.(
      `Failed to attach card image for visual-mode action: ${err.message || err}`,
      "warn"
    );
    return { additionalEmbeds: undefined, additionalFiles: undefined };
  }
}

async function finishVisualCardAction({
  discordClient,
  guildId,
  channelId,
  actor,
  gameData,
  content,
  logger,
  withChannelLock,
  skipPin,
  additionalEmbeds,
  additionalFiles,
}) {
  let posted = false;
  try {
    posted = Boolean(
      await postCommandToGameChannel({
        discordClient,
        guildId,
        channelId,
        actor,
        gameData,
        content,
        logger,
        withChannelLock,
        skipPin,
        additionalEmbeds,
        additionalFiles,
      })
    );
  } catch (err) {
    logger?.log?.(
      `Failed to post visual-mode action to Discord: ${err.message || err}`,
      "warn"
    );
    posted = false;
  }
  const skipPinnedRefresh =
    typeof skipPin === "function" ? skipPin() : Boolean(skipPin);
  if (!posted && !skipPinnedRefresh) {
    try {
      await GameStatusHelper.refreshPinnedStatusAfterGameSave(
        discordClient,
        { guildId, channelId },
        gameData,
        { withChannelLock, pinFromLatest: true }
      );
    } catch (err) {
      logger?.log?.(
        `Pinned status refresh after visual-mode action failed: ${err.message || err}`,
        "warn"
      );
    }
  }
  return posted;
}

async function loadLatestGameForVisualPost({
  getGameData,
  discordClient,
  gameStore,
  guildId,
  channelId,
  withChannelLock,
}) {
  const loader = resolveGetGameData({ getGameData, discordClient, gameStore });
  if (!loader) return null;
  const load = () => loader(guildId, GAME_COLLECTION, channelId);
  if (typeof withChannelLock === "function") {
    return withChannelLock(load);
  }
  return load();
}

async function postLatestVisualCardAction(args, { shouldSkipPin } = {}) {
  try {
    const latest = await loadLatestGameForVisualPost(args);
    if (isMissingGame(latest)) {
      return false;
    }
  } catch {
    // Keep the persist-time snapshot if a refresh read fails.
  }
  if (!args.gameData || args.gameData.isdeleted) return false;
  return finishVisualCardAction({
    ...args,
    skipPin: shouldSkipPin,
  });
}

function applyVisualHandAction(gameData, { action, cardId, actor, userId }) {
  const player = findPlayer(gameData, userId);
  if (!player) {
    return {
      ok: false,
      status: 403,
      error: "not_a_player",
      content: ACTION_ERROR_MESSAGES.not_a_player,
    };
  }
  const result =
    action === "play"
      ? CardMoves.playFromHand(gameData, { player, cardId, actor })
      : action === "discard"
        ? CardMoves.discardFromHand(gameData, { player, cardId, actor })
        : CardMoves.showFromHand(gameData, { player, cardId, actor });
  if (!result.ok) {
    const status = result.error === "not_a_player" ? 403 : 409;
    return {
      ok: false,
      status,
      error: result.error,
      content: result.content,
    };
  }
  return {
    ok: true,
    content: result.content,
    card: result.card,
    revealCard: action === "play" || action === "show",
  };
}

function applyVisualCardAction(gameData, { action, deckName, count, cardId, actor, userId }) {
  if (HAND_ACTIONS.has(action)) {
    return applyVisualHandAction(gameData, { action, cardId, actor, userId });
  }

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

function applyVisualScoreAction(gameData, { scores, actor, playerNames } = {}) {
  const result = PlayerScores.applyPlayerScores(gameData, {
    scores,
    actor,
    actorDisplayName: actor?.displayName,
    playerNames,
  });
  return {
    ok: true,
    content: result.content,
    changed: result.changed,
  };
}

function pendingScoreUserIds(gameData, scores) {
  const ids = [];
  const updates = scores && typeof scores === "object" ? scores : {};
  const players = Array.isArray(gameData?.players) ? gameData.players : [];
  for (const player of players) {
    const id = String(player?.userId || "");
    if (!id) continue;
    if (
      !Object.prototype.hasOwnProperty.call(updates, id) &&
      !Object.prototype.hasOwnProperty.call(updates, player.userId)
    ) {
      continue;
    }
    const raw = Object.prototype.hasOwnProperty.call(updates, id)
      ? updates[id]
      : updates[player.userId];
    const newScore = PlayerScores.scoreValue(raw);
    if (newScore && player.score !== newScore) ids.push(id);
  }
  return ids;
}

async function playerNamesForScoreUpdate(gameData, scores, { discordClient, guildId }) {
  const userIds = pendingScoreUserIds(gameData, scores);
  const playerNames = {};
  if (!userIds.length) return playerNames;
  const displays = await resolvePlayerDisplays({
    discordClient,
    guildId,
    userIds,
    fetchMissing: true,
  });
  for (const userId of userIds) {
    const name = displays[userId]?.name;
    playerNames[userId] =
      typeof name === "string" && name.trim()
        ? name.trim()
        : `Player ${userId}`;
  }
  return playerNames;
}

/**
 * Best-effort Discord posts after the game lock. One worker per channel
 * serializes channel.send so leftover pins cannot race into existence.
 * Every queued chat action line is posted; pin refresh is skipped when a
 * later job is already waiting so only one official pin remains. A hung
 * send stalls this queue only, not mutations or the HTTP response.
 */
function createVisualChannelPostQueue() {
  const pending = new Map();
  const pumps = new Map();

  function settle(entry, value, error) {
    if (!entry || entry.settled) return;
    entry.settled = true;
    if (error) entry.reject(error);
    else entry.resolve(value);
  }

  function queueFor(key) {
    const queue = pending.get(key);
    return Array.isArray(queue) ? queue : [];
  }

  function hasPending(key) {
    return queueFor(key).length > 0;
  }

  function enqueue(guildId, channelId, job) {
    const key = `${guildId}:${channelId}`;
    return new Promise((resolve, reject) => {
      const queue = queueFor(key);
      queue.push({ job, resolve, reject, settled: false });
      pending.set(key, queue);
      if (!pumps.has(key)) {
        pumps.set(key, pump(key));
      }
    });
  }

  async function pump(key) {
    try {
      while (hasPending(key)) {
        const queue = queueFor(key);
        const current = queue.shift();
        if (queue.length === 0) pending.delete(key);
        else pending.set(key, queue);
        try {
          const posted = await current.job({
            shouldSkipPin: () => hasPending(key),
          });
          settle(current, Boolean(posted));
        } catch (err) {
          settle(current, false, err);
        }
      }
    } finally {
      pumps.delete(key);
      if (hasPending(key)) {
        const next = pump(key);
        pumps.set(key, next);
        await next;
      }
    }
  }

  async function drain() {
    for (;;) {
      const inFlight = [...pumps.values()];
      if (inFlight.length === 0 && pending.size === 0) return;
      if (inFlight.length === 0) {
        await Promise.resolve();
        continue;
      }
      await Promise.all(inFlight);
    }
  }

  return { enqueue, drain };
}

const defaultVisualChannelPostQueue = createVisualChannelPostQueue();
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
  for (;;) {
    const pending = [...pendingLockedVisualActions];
    const queueDrain = defaultVisualChannelPostQueue.drain();
    if (pending.length === 0) {
      await queueDrain;
      if (pendingLockedVisualActions.size === 0) return;
      continue;
    }
    await Promise.all([...pending, queueDrain]);
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
 * requestId. The key includes action plus a per-action detail (deck:count for
 * Deal/Draw, the score map for scores) so a reused id for a different action
 * is not swallowed.
 */
function createActionIdempotencyCache({
  ttlMs = 5 * 60 * 1000,
  maxSize = ACTION_IDEMPOTENCY_MAX,
  showCoalesceTtlMs = SHOW_COALESCE_TTL_MS,
} = {}) {
  const completed = new Map();
  const inflight = new Map();

  function cacheKey(userId, guildId, channelId, requestId, action, detail) {
    return `${userId}:${guildId}:${channelId}:${requestId}:${action}:${detail}`;
  }

  function remember(key, result, entryTtlMs = ttlMs) {
    if (completed.size >= maxSize && !completed.has(key)) {
      const oldest = completed.keys().next().value;
      if (oldest != null) completed.delete(oldest);
    }
    completed.set(key, result);
    const held = result;
    setTimeout(() => {
      if (completed.get(key) === held) completed.delete(key);
    }, entryTtlMs).unref?.();
  }

  async function run(requestId, userId, guildId, channelId, fn, actionParts = {}) {
    const id = parseVisualActionRequestId(requestId);
    const action = String(actionParts.action || "");
    const detail = String(actionParts.detail ?? "");
    const key = id ? cacheKey(userId, guildId, channelId, id, action, detail) : null;
    // SHOW does not remove the card, so two tabs / sequential clicks with
    // different requestIds would both 200. Coalesce inflight SHOW of the same
    // card, and reuse a successful SHOW of that card for a short window.
    const coalesceKey =
      action === "show" && detail
        ? `coalesce:show:${userId}:${guildId}:${channelId}:${detail}`
        : null;
    if (!key && !coalesceKey) return fn();
    if (key) {
      const cached = completed.get(key);
      if (cached) return cached;
      if (inflight.has(key)) return inflight.get(key);
    }
    if (coalesceKey) {
      const cachedShow = completed.get(coalesceKey);
      if (cachedShow) return cachedShow;
      if (inflight.has(coalesceKey)) return inflight.get(coalesceKey);
    }
    const promise = Promise.resolve()
      .then(fn)
      .then((result) => {
        if (key) inflight.delete(key);
        if (coalesceKey) inflight.delete(coalesceKey);
        if (result?.status === 200 && key) {
          remember(key, result);
        }
        if (result?.status === 200 && coalesceKey) {
          remember(coalesceKey, result, showCoalesceTtlMs);
        }
        return result;
      })
      .catch((err) => {
        if (key) inflight.delete(key);
        if (coalesceKey) inflight.delete(coalesceKey);
        throw err;
      });
    if (key) inflight.set(key, promise);
    if (coalesceKey) inflight.set(coalesceKey, promise);
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
  fetchImpl,
  botToken,
  hostImageCache,
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
  const hostBoardImages = await resolveHostBoardImages(gameData, {
    fetchImpl,
    botToken,
    discordClient,
    channelId,
    hostImageCache,
  });
  return {
    body: snapshotFromGameData(gameData, {
      channelId,
      guildId,
      userId,
      playerDisplays,
      hostBoardImages,
    }),
    hostBoardImages,
  };
}

async function runVisualCardAction({
  action,
  deckName,
  count,
  cardId,
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
  channelPostQueue,
  fetchImpl,
  botToken,
  hostImageCache,
  idempotencyDetail,
  mutateOnce,
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

  const withChannelLock = (fn) => lock.run(gid, cid, fn);
  const postQueue =
    channelPostQueue && typeof channelPostQueue.enqueue === "function"
      ? channelPostQueue
      : defaultVisualChannelPostQueue;

  const execute = () => {
    let releaseHttp;
    const httpReady = new Promise((resolve, reject) => {
      releaseHttp = { resolve, reject };
    });
    trackLockedVisualAction(async () => {
      let pendingPost = null;
      try {
        pendingPost = await lock.run(gid, cid, async () => {
          try {
            const persisted = await (typeof mutateOnce === "function"
              ? mutateOnce({
                  actor,
                  guildId: gid,
                  channelId: cid,
                  userId: uid,
                  getGameData,
                  discordClient,
                  gameStore,
                  logger,
                })
              : runVisualCardActionOnce({
                  action,
                  deckName,
                  count,
                  cardId,
                  actor,
                  guildId: gid,
                  channelId: cid,
                  userId: uid,
                  getGameData,
                  discordClient,
                  gameStore,
                  logger,
                }));
            if (persisted.status !== 200) {
              releaseHttp.resolve(persisted);
              return null;
            }
            // Snapshot (host-image fetches) stays off the persist lock so
            // slash `/cards hand *` is not stalled by Discord CDN I/O.
            return {
              gameData: cloneDeep(persisted.gameData),
              content: persisted.applied.content,
              card: persisted.applied.card,
              revealCard: persisted.applied.revealCard,
            };
          } catch (err) {
            releaseHttp.reject(err);
            throw err;
          }
        });
      } catch {
        return false;
      }
      if (!pendingPost) return false;
      try {
        const snapshot = await snapshotFromCurrentGame({
          gameData: pendingPost.gameData,
          discordClient,
          guildId: gid,
          channelId: cid,
          userId: uid,
          fetchImpl,
          botToken,
          hostImageCache,
        });
        const snapshotBody = snapshot.body;
        const version = snapshotVersion(pendingPost.gameData, {
          channelId: cid,
          guildId: gid,
          userId: uid,
          hostBoardImages: snapshot.hostBoardImages,
        });
        releaseHttp.resolve({
          status: 200,
          version,
          body: {
            ...snapshotBody,
            version,
            message: pendingPost.content,
          },
        });
      } catch (err) {
        releaseHttp.reject(err);
        return false;
      }
      return postQueue.enqueue(gid, cid, async (queue) => {
        let additionalEmbeds;
        let additionalFiles;
        if (pendingPost.revealCard && pendingPost.card) {
          const parts = await cardReplyPartsForChannel(pendingPost.card, logger);
          additionalEmbeds = parts.additionalEmbeds;
          additionalFiles = parts.additionalFiles;
        }
        return postLatestVisualCardAction(
          {
            discordClient,
            gameStore,
            getGameData,
            guildId: gid,
            channelId: cid,
            actor,
            gameData: pendingPost.gameData,
            content: pendingPost.content,
            logger,
            withChannelLock,
            additionalEmbeds,
            additionalFiles,
          },
          queue
        );
      });
    });
    return httpReady;
  };

  if (idempotency && typeof idempotency.run === "function") {
    return idempotency.run(requestId, uid, gid, cid, execute, {
      action,
      detail:
        idempotencyDetail != null
          ? String(idempotencyDetail)
          : cardId
            ? String(cardId)
            : `${deckName}:${count}`,
    });
  }
  return execute();
}

async function runVisualCardActionOnce({
  action,
  deckName,
  count,
  cardId,
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
    cardId,
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

async function runVisualScoreActionOnce({
  scores,
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

  if (!userIsPlayer(gameData, userId)) {
    return errorBody("not_a_player", 403);
  }

  const playerNames = await playerNamesForScoreUpdate(gameData, scores, {
    discordClient,
    guildId,
  });

  let applied;
  try {
    applied = applyVisualScoreAction(gameData, { scores, actor, playerNames });
  } catch (err) {
    logger?.log?.(
      `Failed to apply visual-mode scores: ${err.message || err}`,
      "error"
    );
    return errorBody("action_failed", 500);
  }

  if (applied.changed) {
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
  }

  return { status: 200, gameData, applied };
}

async function runVisualScoreAction({
  scores,
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
  fetchImpl,
  botToken,
  hostImageCache,
} = {}) {
  return runVisualCardAction({
    action: "scores",
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
    fetchImpl,
    botToken,
    hostImageCache,
    idempotencyDetail: scoresIdempotencyKey(scores),
    mutateOnce: (ctx) =>
      runVisualScoreActionOnce({
        scores,
        ...ctx,
      }),
  });
}

module.exports = {
  ACTION_ERROR_MESSAGES,
  ACTION_IDEMPOTENCY_MAX,
  SHOW_COALESCE_TTL_MS,
  actorFromDiscordUser,
  applyVisualCardAction,
  applyVisualScoreAction,
  createActionIdempotencyCache,
  createGameChannelLock,
  createVisualChannelPostQueue,
  withGameDocumentLock,
  drainLockedVisualActions,
  parseVisualActionBody,
  parseVisualActionRequestId,
  postCommandToGameChannel,
  scoresIdempotencyKey,
  runVisualCardAction,
  runVisualScoreAction,
  visualActionErrorMessage,
};
