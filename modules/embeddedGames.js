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

const MAX_VISIBLE_DECKS = 2;
const STATUS_HISTORY_LIMIT = 8;
const AVATAR_SIZE = 128;

function copyCards(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((card) => card && typeof card === "object" && !Array.isArray(card))
    .map((card) => ({ ...card }));
}

function sortedPlayers(data) {
  const players = Array.isArray(data?.players) ? data.players : [];
  return [...players].sort(
    (a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0)
  );
}

function handCountsHidden(data) {
  const decks = Array.isArray(data?.decks) ? data.decks : [];
  return decks.some(
    (deck) => deck?.hiddenInfo === "hand" || deck?.hiddenInfo === "all"
  );
}

function mainHandCount(player) {
  return Array.isArray(player?.hands?.main) ? player.hands.main.length : 0;
}

function publicHandCount(data, player) {
  if (handCountsHidden(data)) return "?";
  return mainHandCount(player);
}

function displayForPlayer(player, displays) {
  const id = String(player?.userId || "");
  const extra = displays && id ? displays[id] : null;
  const fromDiscord =
    typeof extra?.name === "string" && extra.name.trim() ? extra.name.trim() : "";
  const fromPlayer =
    typeof player?.name === "string" && player.name.trim() ? player.name.trim() : "";
  const name = fromDiscord || fromPlayer || id || "Player";
  const avatarUrl =
    typeof extra?.avatarUrl === "string" && extra.avatarUrl.trim()
      ? extra.avatarUrl.trim()
      : null;
  return { name, avatarUrl };
}

function otherPlayersSummary(data, userId, displays) {
  const uid = String(userId || "");
  return sortedPlayers(data)
    .filter((player) => String(player?.userId || "") && String(player.userId) !== uid)
    .map((player) => {
      const { name, avatarUrl } = displayForPlayer(player, displays);
      return {
        userId: String(player.userId),
        name,
        handCount: publicHandCount(data, player),
        avatarUrl,
      };
    });
}

function deckBackSource(deck) {
  for (const key of ["backUrl", "cardBackUrl", "backImage"]) {
    const value = deck?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isDeckCountHidden(deck) {
  return deck?.hiddenInfo === "all" || deck?.hiddenInfo === "deck";
}

function pileCardCount(pile) {
  return Array.isArray(pile?.cards) ? pile.cards.length : 0;
}

function deckRemaining(deck) {
  const remaining = pileCardCount(deck?.piles?.draw);
  if (isDeckCountHidden(deck) && remaining > 1) return "?";
  return remaining;
}

function deckTotal(deck) {
  if (Array.isArray(deck?.allCards)) return deck.allCards.length;
  const piles = deck?.piles && typeof deck.piles === "object" ? deck.piles : {};
  let total = 0;
  for (const pile of Object.values(piles)) {
    total += pileCardCount(pile);
  }
  return total;
}

function deckSummaries(data) {
  const decks = Array.isArray(data?.decks) ? data.decks : [];
  return decks.slice(0, MAX_VISIBLE_DECKS).map((deck) => {
    const name =
      typeof deck?.name === "string" && deck.name.trim() ? deck.name.trim() : "Deck";
    const summary = {
      name,
      remaining: deckRemaining(deck),
      total: deckTotal(deck),
    };
    const backUrl = deckBackSource(deck);
    if (backUrl) summary.backUrl = backUrl;
    return summary;
  });
}

function tokenValueForPlayer(token, player, viewerId) {
  const count = Number(player?.tokens?.[token.id]) || 0;
  if (token?.isSecret && String(player?.userId) !== String(viewerId)) return "?";
  return count;
}

function playerStatusRow(data, player, viewerId, displays) {
  const id = String(player?.userId || "");
  const { name } = displayForPlayer(player, displays);
  const tokens = {};
  if (Array.isArray(data?.tokens)) {
    for (const token of data.tokens) {
      if (!token || token.id == null) continue;
      tokens[String(token.id)] = tokenValueForPlayer(token, player, viewerId);
    }
  }
  const team =
    Array.isArray(data?.teams) && player?.teamId
      ? data.teams.find((row) => row && row.id === player.teamId)
      : null;
  return {
    userId: id,
    name,
    order: Number.isFinite(Number(player?.order)) ? Number(player.order) : 0,
    score: player?.score == null ? "" : String(player.score),
    handCount: publicHandCount(data, player),
    playAreaCount: Array.isArray(player?.playArea) ? player.playArea.length : 0,
    teamName: team && typeof team.name === "string" ? team.name : "",
    color: typeof player?.color === "string" && player.color.trim() ? player.color : null,
    isYou: id === String(viewerId || ""),
    tokens,
  };
}

function tokenSupply(data) {
  const tokens = Array.isArray(data?.tokens) ? data.tokens : [];
  const players = Array.isArray(data?.players) ? data.players : [];
  return tokens
    .filter((token) => token && token.id != null)
    .map((token) => {
      let held = 0;
      for (const player of players) {
        held += Number(player?.tokens?.[token.id]) || 0;
      }
      const cap =
        typeof token.cap === "number" && Number.isFinite(token.cap) ? token.cap : null;
      const circulation = token.isSecret ? "?" : held;
      let available = null;
      if (cap != null) {
        const left = cap - held;
        available = token.isSecret
          ? left <= 0
            ? "0 (cap met)"
            : String(left)
          : String(Math.max(0, left));
      }
      return {
        id: String(token.id),
        name:
          typeof token.name === "string" && token.name.trim()
            ? token.name.trim()
            : "Token",
        isSecret: Boolean(token.isSecret),
        cap,
        circulation,
        available,
      };
    });
}

function globalPileSummaries(data) {
  const piles = Array.isArray(data?.globalPiles) ? data.globalPiles : [];
  return piles
    .filter((pile) => pile && typeof pile === "object")
    .map((pile) => {
      const cards = Array.isArray(pile.cards) ? pile.cards : [];
      const summary = {
        name:
          typeof pile.name === "string" && pile.name.trim() ? pile.name.trim() : "Pile",
        count: cards.length,
        isSecret: Boolean(pile.isSecret),
      };
      if (pile.showTopCard && cards.length > 0) {
        const top = cards[cards.length - 1];
        if (top && typeof top.name === "string" && top.name.trim()) {
          summary.topCardName = top.name.trim();
        }
      }
      return summary;
    });
}

function historySummaries(data) {
  const history = Array.isArray(data?.history) ? data.history : [];
  return history
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.summary === "string" &&
        entry.summary.trim()
    )
    .slice(-STATUS_HISTORY_LIMIT)
    .map((entry) => ({
      summary: entry.summary.trim(),
      category: typeof entry.action?.category === "string" ? entry.action.category : "",
    }));
}

function statusSummary(data, userId, displays) {
  return {
    gameName: typeof data?.name === "string" ? data.name : "",
    reverseOrder: Boolean(data?.reverseOrder),
    isCustomGame: Boolean(data?.isCustomGame),
    players: sortedPlayers(data).map((player) =>
      playerStatusRow(data, player, userId, displays)
    ),
    tokens: tokenSupply(data),
    globalPiles: globalPileSummaries(data),
    history: historySummaries(data),
  };
}

function snapshotFromGameData(
  data,
  { channelId, guildId, userId, playerDisplays } = {}
) {
  const uid = String(userId || "");
  const displays =
    playerDisplays && typeof playerDisplays === "object" ? playerDisplays : {};
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
    otherPlayers: otherPlayersSummary(data, uid, displays),
    decks: deckSummaries(data),
    status: statusSummary(data, uid, displays),
  };
}

function avatarUrlFromMember(member) {
  const opts = { extension: "png", size: AVATAR_SIZE };
  if (typeof member?.displayAvatarURL === "function") {
    try {
      const url = member.displayAvatarURL(opts);
      if (url) return url;
    } catch {
      // fall through
    }
  }
  const user = member?.user;
  if (typeof user?.displayAvatarURL === "function") {
    try {
      const url = user.displayAvatarURL(opts);
      if (url) return url;
    } catch {
      // ignore
    }
  }
  return null;
}

async function playerDisplayFromDiscord(discordClient, guildId, userId) {
  if (!discordClient || !guildId || !userId) return null;
  try {
    const guilds = discordClient.guilds;
    const cachedGuild = guilds?.cache?.get?.(guildId);
    const guild =
      cachedGuild ||
      (typeof guilds?.fetch === "function" ? await guilds.fetch(guildId) : null);
    if (!guild) return null;
    const cachedMember = guild.members?.cache?.get?.(userId);
    const member =
      cachedMember ||
      (typeof guild.members?.fetch === "function"
        ? await guild.members.fetch(userId)
        : null);
    if (!member) return null;
    const name =
      (typeof member.displayName === "string" && member.displayName.trim()
        ? member.displayName.trim()
        : "") ||
      (typeof member.user?.global_name === "string" && member.user.global_name.trim()
        ? member.user.global_name.trim()
        : "") ||
      (typeof member.user?.username === "string" && member.user.username.trim()
        ? member.user.username.trim()
        : "") ||
      null;
    return {
      name,
      avatarUrl: avatarUrlFromMember(member),
    };
  } catch {
    return null;
  }
}

async function resolvePlayerDisplays({ discordClient, guildId, userIds } = {}) {
  const displays = {};
  const ids = Array.isArray(userIds)
    ? [...new Set(userIds.map((id) => String(id || "")).filter(Boolean))]
    : [];
  if (!ids.length) return displays;
  await Promise.all(
    ids.map(async (userId) => {
      const display = await playerDisplayFromDiscord(discordClient, guildId, userId);
      if (display && (display.name || display.avatarUrl)) {
        displays[userId] = display;
      }
    })
  );
  return displays;
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

  const userIds = Array.isArray(data.players)
    ? data.players.map((player) => String(player?.userId || "")).filter(Boolean)
    : [];
  const playerDisplays = await resolvePlayerDisplays({
    discordClient,
    guildId: gid,
    userIds,
  });

  return {
    status: 200,
    body: snapshotFromGameData(data, {
      channelId: cid,
      guildId: gid,
      userId: uid,
      playerDisplays,
    }),
  };
}

module.exports = {
  DISCORD_API_BASE,
  DISCORD_EPOCH_MS,
  GAME_COLLECTION,
  HISTORY_KEEP_LIMIT,
  MAX_VISIBLE_DECKS,
  STATUS_HISTORY_LIMIT,
  channelNameFromDiscordClient,
  copyCards,
  createdAtMs,
  deckSummaries,
  discordSnowflakeMs,
  filterAndSortActiveGames,
  isActivePlayerGame,
  isMissingGame,
  listActiveGamesForUser,
  optionalDiscordAccessGuard,
  parseTimestampMs,
  publicHandCount,
  resolveGetGameData,
  resolvePlayerDisplays,
  snapshotFromGameData,
  snapshotGameForUser,
  userIsPlayer,
};
