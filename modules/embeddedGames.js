"use strict";

const { ChannelType, PermissionFlagsBits } = require("discord.js");
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

function teamForPlayer(data, player) {
  if (!Array.isArray(data?.teams) || player?.teamId == null || player.teamId === "") {
    return null;
  }
  const id = String(player.teamId);
  return data.teams.find((row) => row && String(row.id) === id) || null;
}

function teamNameForPlayer(data, player) {
  const team = teamForPlayer(data, player);
  return team && typeof team.name === "string" ? team.name : "";
}

function teamIdForPlayer(data, player) {
  const team = teamForPlayer(data, player);
  if (team?.id != null && String(team.id)) return String(team.id);
  if (player?.teamId == null || player.teamId === "") return "";
  return String(player.teamId);
}

function teamRoster(data) {
  if (!Array.isArray(data?.teams)) return [];
  return data.teams
    .filter((team) => team && typeof team === "object" && !Array.isArray(team))
    .map((team) => ({
      id: team.id == null ? "" : String(team.id),
      name: typeof team.name === "string" ? team.name.trim() : "",
      color:
        typeof team.color === "string" && team.color.trim()
          ? team.color.trim()
          : null,
    }))
    .filter((team) => team.name);
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
        teamId: teamIdForPlayer(data, player),
        teamName: teamNameForPlayer(data, player),
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
  return {
    userId: id,
    name,
    order: Number.isFinite(Number(player?.order)) ? Number(player.order) : 0,
    score: player?.score == null ? "" : String(player.score),
    handCount: publicHandCount(data, player),
    playAreaCount: Array.isArray(player?.playArea) ? player.playArea.length : 0,
    teamName: teamNameForPlayer(data, player),
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
    .map((entry) => {
      const row = {
        summary: entry.summary.trim(),
        category:
          typeof entry.action?.category === "string" ? entry.action.category : "",
      };
      if (typeof entry.id === "string" && entry.id.trim()) {
        row.id = entry.id.trim();
      }
      if (typeof entry.timestamp === "string" && entry.timestamp.trim()) {
        row.timestamp = entry.timestamp.trim();
      }
      return row;
    });
}

function djb2Hex(text) {
  let hash = 5381;
  const raw = String(text || "");
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/** Opaque cheap fingerprint of game JSON. Poll this before a full snapshot. */
function snapshotVersion(data) {
  const raw = JSON.stringify(data ?? null);
  const history = Array.isArray(data?.history) ? data.history : [];
  const last = history.length ? history[history.length - 1] : null;
  const lastId =
    last && typeof last.id === "string" && last.id.trim() ? last.id.trim() : "";
  return `${raw.length}|${history.length}|${lastId}|${djb2Hex(raw)}`;
}

function formatEtag(version) {
  const raw = String(version || "");
  return `"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function etagMatches(header, version) {
  if (!version) return false;
  const expected = formatEtag(version);
  const tags = String(header || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return tags.includes(expected) || tags.includes(`W/${expected}`);
}

function statusSummary(data, userId, displays) {
  return {
    gameName: typeof data?.name === "string" ? data.name : "",
    reverseOrder: Boolean(data?.reverseOrder),
    isCustomGame: Boolean(data?.isCustomGame),
    players: sortedPlayers(data).map((player) =>
      playerStatusRow(data, player, userId, displays)
    ),
    teams: teamRoster(data),
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

const THREAD_CHANNEL_TYPES = new Set([
  ChannelType.AnnouncementThread,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
]);

function accessDenied(error, status = 403) {
  return { ok: false, status, body: { error } };
}

const DISCORD_LOOKUP_TTL_MS = 45_000;
const DISCORD_LOOKUP_CACHE_MAX = 256;
const CHEAP_RETRY_AFTER_MS = 1_000;

function asPermissionBits(value) {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
}

function hasPermission(bits, flag) {
  return (bits & flag) === flag;
}

async function readJsonBody(res) {
  if (res == null || typeof res.json !== "function") return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  const lower = name.toLowerCase();
  if (headers[name] != null) return headers[name];
  if (headers[lower] != null) return headers[lower];
  for (const key of Object.keys(headers)) {
    if (String(key).toLowerCase() === lower) return headers[key];
  }
  return null;
}

function retryAfterMs(result) {
  const rawHeader = headerValue(result?.headers, "retry-after");
  if (rawHeader != null && String(rawHeader).trim() !== "") {
    const seconds = Number(rawHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds * 1000);
    }
  }
  const fromBody = Number(result?.body?.retry_after);
  if (Number.isFinite(fromBody) && fromBody >= 0) {
    return Math.ceil(fromBody * 1000);
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createDiscordLookupCache({
  ttlMs = DISCORD_LOOKUP_TTL_MS,
  maxSize = DISCORD_LOOKUP_CACHE_MAX,
} = {}) {
  const entries = new Map();
  const inflight = new Map();

  function get(key) {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key, value) {
    if (entries.size >= maxSize && !entries.has(key)) {
      const oldest = entries.keys().next().value;
      if (oldest != null) entries.delete(oldest);
    }
    entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  return { get, set, inflight, size: () => entries.size };
}

async function discordBotGet({
  fetchFn,
  headers,
  path,
  cache,
  wait = sleep,
} = {}) {
  const url = `${DISCORD_API_BASE}${path}`;
  const cached = cache?.get?.(path);
  if (cached) return cached;
  if (cache?.inflight?.has?.(path)) return cache.inflight.get(path);

  async function requestOnce() {
    try {
      const res = await fetchFn(url, { headers });
      if (res == null) return { status: 0, body: null, headers: null };
      return {
        status: res.status,
        body: await readJsonBody(res),
        headers: res.headers || null,
      };
    } catch {
      return { status: 0, body: null, headers: null };
    }
  }

  const load = (async () => {
    let result = await requestOnce();
    if (result.status === 429) {
      const delayMs = retryAfterMs(result);
      if (delayMs != null && delayMs <= CHEAP_RETRY_AFTER_MS) {
        await wait(delayMs);
        result = await requestOnce();
      }
    }
    if (cache && (result.status === 200 || result.status === 404)) {
      cache.set(path, { status: result.status, body: result.body });
    }
    return result;
  })();

  if (cache?.inflight) {
    cache.inflight.set(path, load);
    try {
      return await load;
    } finally {
      cache.inflight.delete(path);
    }
  }
  return load;
}

function denyFromLookup(result) {
  if (!result || result.status === 0) return accessDenied("access_unverified");
  if (result.status === 429) return accessDenied("try_again");
  return null;
}

function applyPermissionOverwrites(bits, overwrites, memberId, roleIds, guildId) {
  const list = Array.isArray(overwrites) ? overwrites : [];
  const roleSet = new Set((roleIds || []).map(String));
  const everyone = list.find((ow) => String(ow?.id) === String(guildId));
  if (everyone) {
    bits &= ~asPermissionBits(everyone.deny);
    bits |= asPermissionBits(everyone.allow);
  }
  let allow = 0n;
  let deny = 0n;
  for (const ow of list) {
    const id = String(ow?.id || "");
    if (!id || id === String(guildId) || id === String(memberId)) continue;
    if (!roleSet.has(id)) continue;
    deny |= asPermissionBits(ow.deny);
    allow |= asPermissionBits(ow.allow);
  }
  bits &= ~deny;
  bits |= allow;
  const memberOverwrite = list.find((ow) => String(ow?.id) === String(memberId));
  if (memberOverwrite) {
    bits &= ~asPermissionBits(memberOverwrite.deny);
    bits |= asPermissionBits(memberOverwrite.allow);
  }
  return bits;
}

function memberChannelPermissions({
  member,
  channel,
  parent,
  roles,
  guildId,
  ownerId,
} = {}) {
  const uid = String(member?.user?.id || member?.id || "");
  if (uid && uid === String(ownerId || "")) {
    return ~0n;
  }
  const roleList = Array.isArray(roles) ? roles : [];
  const everyone = roleList.find((role) => String(role?.id) === String(guildId));
  let bits = asPermissionBits(everyone?.permissions);
  const memberRoles = Array.isArray(member?.roles) ? member.roles.map(String) : [];
  for (const role of roleList) {
    if (memberRoles.includes(String(role?.id))) {
      bits |= asPermissionBits(role.permissions);
    }
  }
  if (hasPermission(bits, PermissionFlagsBits.Administrator)) {
    return ~0n;
  }
  const overwriteChannel = parent || channel;
  return applyPermissionOverwrites(
    bits,
    overwriteChannel?.permission_overwrites,
    uid,
    memberRoles,
    guildId
  );
}

/**
 * Mutating visual-mode actions fail closed: the user must be a guild member
 * who can view the channel/thread, and the channel must belong to that guild.
 * Missing bot token, Discord errors, or incomplete replies are denials.
 */
async function requiredDiscordAccessGuard({
  fetchImpl,
  botToken,
  discordClient,
  guildId,
  channelId,
  userId,
  lookupCache,
  wait,
} = {}) {
  const token = String(botToken || discordClient?.token || "").trim();
  const gid = String(guildId || "").trim();
  const uid = String(userId || "").trim();
  const cid = String(channelId || "").trim();
  if (!token) return accessDenied("access_unverified");
  if (!gid || !uid || !cid) return accessDenied("access_unverified");

  const fetchFn = fetchImpl || fetch;
  const headers = { Authorization: `Bot ${token}` };

  async function botGet(path) {
    return discordBotGet({
      fetchFn,
      headers,
      path,
      cache: lookupCache,
      wait,
    });
  }

  const memberRes = await botGet(
    `/guilds/${encodeURIComponent(gid)}/members/${encodeURIComponent(uid)}`
  );
  const memberDenied = denyFromLookup(memberRes);
  if (memberDenied) return memberDenied;
  if (memberRes.status === 404) return accessDenied("not_a_guild_member");
  if (memberRes.status !== 200) return accessDenied("access_unverified");
  const member = memberRes.body;
  if (!member || typeof member !== "object") return accessDenied("access_unverified");

  const channelRes = await botGet(`/channels/${encodeURIComponent(cid)}`);
  const channelDenied = denyFromLookup(channelRes);
  if (channelDenied) return channelDenied;
  if (channelRes.status !== 200) return accessDenied("access_unverified");
  const channel = channelRes.body;
  if (!channel || typeof channel !== "object") return accessDenied("access_unverified");

  const isThread = THREAD_CHANNEL_TYPES.has(channel.type);
  let parent = null;
  if (isThread && channel.parent_id) {
    const parentRes = await botGet(
      `/channels/${encodeURIComponent(String(channel.parent_id))}`
    );
    const parentDenied = denyFromLookup(parentRes);
    if (parentDenied) return parentDenied;
    if (parentRes.status !== 200) return accessDenied("access_unverified");
    parent = parentRes.body;
    if (!parent || typeof parent !== "object") return accessDenied("access_unverified");
  }

  const channelGuildId = String(
    channel.guild_id || parent?.guild_id || ""
  ).trim();
  if (!channelGuildId || channelGuildId !== gid) {
    return accessDenied("channel_mismatch");
  }

  const rolesRes = await botGet(`/guilds/${encodeURIComponent(gid)}/roles`);
  const rolesDenied = denyFromLookup(rolesRes);
  if (rolesDenied) return rolesDenied;
  if (rolesRes.status !== 200) return accessDenied("access_unverified");
  const roles = rolesRes.body;
  if (!Array.isArray(roles)) return accessDenied("access_unverified");

  const guildRes = await botGet(`/guilds/${encodeURIComponent(gid)}`);
  const guildDenied = denyFromLookup(guildRes);
  if (guildDenied) return guildDenied;
  if (guildRes.status !== 200) return accessDenied("access_unverified");
  const guild = guildRes.body;
  if (!guild || typeof guild !== "object") return accessDenied("access_unverified");

  const permissions = memberChannelPermissions({
    member,
    channel,
    parent,
    roles,
    guildId: gid,
    ownerId: guild.owner_id,
  });
  if (!hasPermission(permissions, PermissionFlagsBits.ViewChannel)) {
    return accessDenied("forbidden");
  }

  if (channel.type === ChannelType.PrivateThread) {
    const canManageThreads = hasPermission(
      permissions,
      PermissionFlagsBits.ManageThreads
    );
    const threadMemberRes = await botGet(
      `/channels/${encodeURIComponent(cid)}/thread-members/${encodeURIComponent(uid)}`
    );
    const threadDenied = denyFromLookup(threadMemberRes);
    if (threadDenied) return threadDenied;
    if (threadMemberRes.status === 404 && !canManageThreads) {
      return accessDenied("forbidden");
    }
    if (threadMemberRes.status !== 200 && threadMemberRes.status !== 404) {
      return accessDenied("access_unverified");
    }
  }

  return { ok: true, member };
}

async function loadViewerGame({
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
    data,
    version: snapshotVersion(data),
    guildId: gid,
    channelId: cid,
    userId: uid,
  };
}

async function versionGameForUser({ ifNoneMatch, ...opts } = {}) {
  const loaded = await loadViewerGame(opts);
  if (loaded.status !== 200) {
    return { status: loaded.status, body: loaded.body };
  }
  if (etagMatches(ifNoneMatch, loaded.version)) {
    return { status: 304, version: loaded.version };
  }
  return {
    status: 200,
    version: loaded.version,
    body: { version: loaded.version },
  };
}

async function snapshotGameForUser({ ifNoneMatch, ...opts } = {}) {
  const loaded = await loadViewerGame(opts);
  if (loaded.status !== 200) {
    return { status: loaded.status, body: loaded.body };
  }
  if (etagMatches(ifNoneMatch, loaded.version)) {
    return { status: 304, version: loaded.version };
  }

  const userIds = Array.isArray(loaded.data.players)
    ? loaded.data.players
        .map((player) => String(player?.userId || ""))
        .filter(Boolean)
    : [];
  const playerDisplays = await resolvePlayerDisplays({
    discordClient: opts.discordClient,
    guildId: loaded.guildId,
    userIds,
  });

  return {
    status: 200,
    version: loaded.version,
    body: {
      ...snapshotFromGameData(loaded.data, {
        channelId: loaded.channelId,
        guildId: loaded.guildId,
        userId: loaded.userId,
        playerDisplays,
      }),
      version: loaded.version,
    },
  };
}

module.exports = {
  CHEAP_RETRY_AFTER_MS,
  DISCORD_API_BASE,
  DISCORD_EPOCH_MS,
  DISCORD_LOOKUP_TTL_MS,
  GAME_COLLECTION,
  HISTORY_KEEP_LIMIT,
  MAX_VISIBLE_DECKS,
  STATUS_HISTORY_LIMIT,
  channelNameFromDiscordClient,
  copyCards,
  createdAtMs,
  createDiscordLookupCache,
  deckSummaries,
  discordSnowflakeMs,
  filterAndSortActiveGames,
  isActivePlayerGame,
  isMissingGame,
  listActiveGamesForUser,
  memberChannelPermissions,
  optionalDiscordAccessGuard,
  requiredDiscordAccessGuard,
  parseTimestampMs,
  publicHandCount,
  resolveGetGameData,
  resolvePlayerDisplays,
  snapshotFromGameData,
  snapshotGameForUser,
  snapshotVersion,
  etagMatches,
  formatEtag,
  userIsPlayer,
  versionGameForUser,
};
