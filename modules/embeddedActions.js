"use strict";

const GameHelper = require("./GlobalGameHelper");
const GameStatusHelper = require("./GameStatusHelper");
const CardMoves = require("./cardMoves");
const {
  GAME_COLLECTION,
  isMissingGame,
  resolveGetGameData,
  snapshotGameForUser,
  userIsPlayer,
} = require("./embeddedGames");

function displayNameFromDiscordUser(user) {
  if (!user || typeof user !== "object") return null;
  for (const value of [user.global_name, user.username]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

const VISUAL_ACTION_MIN = 1;
const VISUAL_ACTION_MAX = 99;
const VISUAL_ACTIONS = new Set(["deal", "draw"]);

function parseVisualActionCount(value) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(n) || n < VISUAL_ACTION_MIN || n > VISUAL_ACTION_MAX) {
    return null;
  }
  return n;
}

function parseVisualActionBody(body = {}) {
  const action = String(body.action || "").trim().toLowerCase();
  if (!VISUAL_ACTIONS.has(action)) {
    return { error: "invalid_action", status: 400 };
  }
  const deckName = typeof body.deck === "string" ? body.deck.trim() : "";
  if (!deckName) {
    return { error: "missing_deck", status: 400 };
  }
  const count = parseVisualActionCount(body.count);
  if (count == null) {
    return { error: "invalid_count", status: 400 };
  }
  return { action, deckName, count };
}

function actorFromDiscordUser(user) {
  const displayName =
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
  if (!discordClient) return;
  const channel = await resolveDiscordChannel(discordClient, channelId);
  if (!channel) {
    logger?.log?.(
      `Visual-mode action could not resolve Discord channel ${channelId}`,
      "warn"
    );
    return;
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

async function runVisualCardAction({
  action,
  deckName,
  count,
  user,
  guildId,
  channelId,
  getGameData,
  discordClient,
  gameStore,
  logger,
} = {}) {
  const gid = String(guildId || "").trim();
  const cid = String(channelId || "").trim();
  const uid = String(user?.id || "").trim();
  if (!gid) return { status: 400, body: { error: "missing_guild" } };
  if (!cid) return { status: 400, body: { error: "missing_channel" } };
  if (!uid) return { status: 401, body: { error: "unauthorized" } };

  const loader = resolveGetGameData({ getGameData, discordClient, gameStore });
  if (!loader) {
    return { status: 404, body: { error: "no_game" } };
  }

  let gameData = null;
  try {
    gameData = await loader(gid, GAME_COLLECTION, cid);
  } catch (err) {
    logger?.log?.(
      `Failed to load game for visual-mode action: ${err.message || err}`,
      "error"
    );
    return { status: 500, body: { error: "action_failed" } };
  }

  if (isMissingGame(gameData)) {
    return { status: 404, body: { error: "no_game" } };
  }
  if (!userIsPlayer(gameData, uid)) {
    return { status: 403, body: { error: "not_a_player" } };
  }

  const actor = actorFromDiscordUser(user);
  const applied = applyVisualCardAction(gameData, {
    action,
    deckName,
    count,
    actor,
    userId: uid,
  });
  if (!applied.ok) {
    return {
      status: applied.status,
      body: { error: applied.error, message: applied.content },
    };
  }

  try {
    await persistGameData({
      discordClient,
      gameStore,
      guildId: gid,
      channelId: cid,
      gameData,
    });
  } catch (err) {
    logger?.log?.(
      `Failed to save visual-mode action: ${err.message || err}`,
      "error"
    );
    return { status: 500, body: { error: "action_failed" } };
  }

  try {
    await postCommandToGameChannel({
      discordClient,
      guildId: gid,
      channelId: cid,
      actor,
      gameData,
      content: applied.content,
      logger,
    });
  } catch (err) {
    logger?.log?.(
      `Failed to post visual-mode action to Discord: ${err.message || err}`,
      "warn"
    );
  }

  const snapshot = await snapshotGameForUser({
    getGameData: loader,
    discordClient,
    gameStore,
    guildId: gid,
    channelId: cid,
    userId: uid,
    logger,
  });
  if (snapshot.status !== 200) {
    return snapshot;
  }
  return {
    status: 200,
    body: {
      ...snapshot.body,
      message: applied.content,
    },
  };
}

module.exports = {
  VISUAL_ACTION_MAX,
  VISUAL_ACTION_MIN,
  actorFromDiscordUser,
  applyVisualCardAction,
  parseVisualActionBody,
  parseVisualActionCount,
  postCommandToGameChannel,
  runVisualCardAction,
};
