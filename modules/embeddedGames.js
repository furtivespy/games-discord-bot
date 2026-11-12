"use strict";

const GameDB = require("../db/anygame");

const GAME_COLLECTION = GameDB.ACTION_CATEGORIES.GAME;
const DISCORD_EPOCH_MS = 1_420_070_400_000;
// recordMove keeps only the last 500 history rows; a truncated log is not a
// reliable creation signal.
const HISTORY_KEEP_LIMIT = 500;

/**
 * Game documents have no dedicated createdAt field. Newest-first sorting uses
 * this signal, in order:
 * 1. earliest history[] GAME + CREATE timestamp (written at /game newgame,
 *    newgameplus, and LFG start via recordMove)
 * 2. earliest history[].timestamp, only when the log is shorter than the
 *    500-entry cap (so CREATE was never written, not dropped)
 * 3. Discord channel/thread snowflake time from channel_id
 * 4. SQLite game_documents.updated_at (last write, not creation)
 */

function parseTimestampMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)
    ? `${raw.replace(" ", "T")}${raw.endsWith("Z") ? "" : "Z"}`
    : raw;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function discordSnowflakeMs(id) {
  const s = String(id || "").trim();
  if (!/^\d{17,20}$/.test(s)) return null;
  try {
    return Number((BigInt(s) >> 22n) + BigInt(DISCORD_EPOCH_MS));
  } catch {
    return null;
  }
}

function gameCreateHistoryMs(data) {
  const history = Array.isArray(data?.history) ? data.history : [];
  let earliest = null;
  for (const entry of history) {
    if (entry?.action?.category !== GameDB.ACTION_CATEGORIES.GAME) continue;
    if (entry?.action?.type !== GameDB.ACTION_TYPES.CREATE) continue;
    const ms = parseTimestampMs(entry.timestamp);
    if (ms == null) continue;
    if (earliest == null || ms < earliest) earliest = ms;
  }
  return earliest;
}

function earliestHistoryMs(data) {
  const history = Array.isArray(data?.history) ? data.history : [];
  let earliest = null;
  for (const entry of history) {
    const ms = parseTimestampMs(entry.timestamp);
    if (ms == null) continue;
    if (earliest == null || ms < earliest) earliest = ms;
  }
  return earliest;
}

function createdAtMs(doc) {
  const data = doc?.data && typeof doc.data === "object" ? doc.data : doc;
  const fromCreate = gameCreateHistoryMs(data);
  if (fromCreate != null) return fromCreate;
  const history = Array.isArray(data?.history) ? data.history : [];
  if (history.length < HISTORY_KEEP_LIMIT) {
    const fromHistory = earliestHistoryMs(data);
    if (fromHistory != null) return fromHistory;
  }
  const fromSnowflake = discordSnowflakeMs(doc?.channelId);
  if (fromSnowflake != null) return fromSnowflake;
  const fromUpdated = parseTimestampMs(doc?.updatedAt);
  if (fromUpdated != null) return fromUpdated;
  return 0;
}

function userIsPlayer(data, userId) {
  const id = String(userId || "");
  if (!id || !Array.isArray(data?.players)) return false;
  return data.players.some((player) => String(player?.userId) === id);
}

function isActivePlayerGame(data, userId) {
  if (!data || typeof data !== "object") return false;
  if (data.isdeleted === true) return false;
  return userIsPlayer(data, userId);
}

function fallbackChannelName(data, channelId) {
  const name = typeof data?.name === "string" ? data.name.trim() : "";
  if (name) return name;
  return `Channel ${channelId}`;
}

function filterAndSortActiveGames(documents, userId) {
  const rows = Array.isArray(documents) ? documents : [];
  return rows
    .filter((doc) => isActivePlayerGame(doc?.data, userId))
    .sort((a, b) => {
      const diff = createdAtMs(b) - createdAtMs(a);
      if (diff !== 0) return diff;
      return String(a.channelId).localeCompare(String(b.channelId));
    });
}

async function resolveChannelName(channelId, fetchChannelName) {
  if (typeof fetchChannelName !== "function") return null;
  try {
    const name = await fetchChannelName(channelId);
    if (typeof name === "string" && name.trim()) return name.trim();
  } catch {
    return null;
  }
  return null;
}

async function listActiveGamesForUser({
  gameStore,
  guildId,
  userId,
  fetchChannelName,
  logger,
} = {}) {
  let documents = [];
  try {
    if (gameStore && typeof gameStore.listGameDocuments === "function") {
      documents = gameStore.listGameDocuments(guildId, GAME_COLLECTION) || [];
    }
  } catch (err) {
    logger?.log?.(
      `Failed to list embedded-app games: ${err.message || err}`,
      "error"
    );
    return { status: 500, body: { error: "list_failed" } };
  }

  const active = filterAndSortActiveGames(documents, userId);
  const games = await Promise.all(
    active.map(async (doc) => {
      const channelId = String(doc.channelId);
      const channelName =
        (await resolveChannelName(channelId, fetchChannelName)) ||
        fallbackChannelName(doc.data, channelId);
      return { channelId, channelName };
    })
  );
  return { status: 200, body: { games } };
}

async function channelNameFromDiscordClient(discordClient, channelId) {
  if (!discordClient || channelId == null || channelId === "") return null;
  const id = String(channelId);
  try {
    const cached = discordClient.channels?.cache?.get?.(id);
    const channel =
      cached ||
      (typeof discordClient.channels?.fetch === "function"
        ? await discordClient.channels.fetch(id)
        : null);
    const name = channel?.name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

function isMissingGame(data) {
  if (!data || typeof data !== "object") return true;
  if (data.isdeleted === true) return true;
  return Object.keys(data).length === 0;
}

function copyCards(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((card) => card && typeof card === "object" && !Array.isArray(card))
    .map((card) => ({ ...card }));
}

function snapshotFromGameData(data, { channelId, guildId, userId } = {}) {
  const uid = String(userId || "");
  const player = Array.isArray(data?.players)
    ? data.players.find((row) => String(row?.userId) === uid)
    : null;
  return {
    gameName: typeof data?.name === "string" ? data.name : "",
    channelId: String(channelId || ""),
    guildId: String(guildId || ""),
    hand: copyCards(player?.hands?.main),
    playArea: copyCards(player?.playArea),
    gameBoard: copyCards(data?.gameBoard),
  };
}

function resolveGetGameData({ getGameData, discordClient, gameStore } = {}) {
  if (typeof getGameData === "function") return getGameData;
  if (typeof discordClient?.getGameDataV2 === "function") {
    return (guildId, collection, channelId) =>
      discordClient.getGameDataV2(guildId, collection, channelId);
  }
  if (typeof gameStore?.getSpecificGameData === "function") {
    return (guildId, collection, channelId) =>
      gameStore.getSpecificGameData(guildId, collection, channelId);
  }
  return null;
}

const DISCORD_API_BASE = "https://discord.com/api/v10";

function discordErrorCode(err) {
  return err?.code || err?.status || null;
}

/**
 * Optional cheap guard: the user is a guild member and the selected channel
 * exists. Fail-open on network / permission errors. A 404 member is a hard no.
 * A missing channel does not skip the game-document lookup — the selected
 * channel id is the document key, and a leftover thread game should still load.
 */
async function optionalDiscordAccessGuard({
  fetchImpl,
  botToken,
  discordClient,
  guildId,
  channelId,
  userId,
} = {}) {
  const token = String(botToken || discordClient?.token || "").trim();
  const gid = String(guildId || "").trim();
  const uid = String(userId || "").trim();
  const cid = String(channelId || "").trim();
  if (!token || !gid || !uid) return { ok: true };

  const fetchFn = fetchImpl || fetch;
  try {
    const memberRes = await fetchFn(
      `${DISCORD_API_BASE}/guilds/${encodeURIComponent(gid)}/members/${encodeURIComponent(uid)}`,
      { headers: { Authorization: `Bot ${token}` } }
    );
    if (memberRes.status === 404) {
      return { ok: false, status: 403, body: { error: "not_a_player" } };
    }
  } catch (err) {
    const code = discordErrorCode(err);
    if (code === 10007 || code === 404) {
      return { ok: false, status: 403, body: { error: "not_a_player" } };
    }
  }

  if (cid) {
    try {
      await fetchFn(`${DISCORD_API_BASE}/channels/${encodeURIComponent(cid)}`, {
        headers: { Authorization: `Bot ${token}` },
      });
    } catch {
      // Channel existence is informational only.
    }
  }
  return { ok: true };
}

async function snapshotGameForUser({
  getGameData,
  discordClient,
  gameStore,
  guildId,
  channelId,
  userId,
  logger,
} = {}) {
  const gid = String(guildId || "").trim();
  const cid = String(channelId || "").trim();
  const uid = String(userId || "").trim();
  if (!gid) return { status: 400, body: { error: "missing_guild" } };
  if (!cid) return { status: 400, body: { error: "missing_channel" } };
  if (!uid) return { status: 401, body: { error: "unauthorized" } };

  const loader = resolveGetGameData({ getGameData, discordClient, gameStore });
  if (!loader) {
    return { status: 404, body: { error: "no_game" } };
  }

  let data = null;
  try {
    data = await loader(gid, GAME_COLLECTION, cid);
  } catch (err) {
    logger?.log?.(
      `Failed to load embedded-app snapshot: ${err.message || err}`,
      "error"
    );
    return { status: 500, body: { error: "snapshot_failed" } };
  }

  if (isMissingGame(data)) {
    return { status: 404, body: { error: "no_game" } };
  }
  if (!userIsPlayer(data, uid)) {
    return { status: 403, body: { error: "not_a_player" } };
  }

  return {
    status: 200,
    body: snapshotFromGameData(data, {
      channelId: cid,
      guildId: gid,
      userId: uid,
    }),
  };
}

module.exports = {
  DISCORD_API_BASE,
  DISCORD_EPOCH_MS,
  GAME_COLLECTION,
  HISTORY_KEEP_LIMIT,
  channelNameFromDiscordClient,
  copyCards,
  createdAtMs,
  discordSnowflakeMs,
  filterAndSortActiveGames,
  isActivePlayerGame,
  isMissingGame,
  listActiveGamesForUser,
  optionalDiscordAccessGuard,
  parseTimestampMs,
  resolveGetGameData,
  snapshotFromGameData,
  snapshotGameForUser,
  userIsPlayer,
};
