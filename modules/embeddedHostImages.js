"use strict";

const GameDB = require("../db/anygame");

/** Discord allows 10 files on one message. */
const MAX_HOST_BOARD_IMAGES = 10;
/** Discord Get Channel Messages max `limit` is 100. */
const HOST_IMAGE_MESSAGE_LIMIT = 100;
/** Newest-first pages to scan so chat after a setup post still finds it. */
const HOST_IMAGE_MESSAGE_SCAN_MAX = 300;
const HOST_IMAGE_CACHE_TTL_MS = 10_000;
const IMAGE_FILENAME = /\.(avif|bmp|gif|jpe?g|png|webp)$/i;

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

function asItemList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value.values === "function") {
    return [...value.values()];
  }
  return [];
}

function gameBoardHasCards(data) {
  if (!Array.isArray(data?.gameBoard)) return false;
  return data.gameBoard.some(
    (card) => card && typeof card === "object" && !Array.isArray(card)
  );
}

function shouldUseHostBoardImages(data) {
  return !gameBoardHasCards(data);
}

/**
 * The game host is the user who created the game: earliest GAME + CREATE
 * history row with an actor user id (/game newgame, newgameplus, LFG start).
 */
function gameHostUserId(data) {
  const history = Array.isArray(data?.history) ? data.history : [];
  let hostId = "";
  let earliest = null;
  for (const entry of history) {
    if (entry?.action?.category !== GameDB.ACTION_CATEGORIES.GAME) continue;
    if (entry?.action?.type !== GameDB.ACTION_TYPES.CREATE) continue;
    const userId = String(entry?.actor?.userId || "").trim();
    if (!userId) continue;
    const ms = parseTimestampMs(entry.timestamp);
    if (ms == null) {
      if (!hostId) hostId = userId;
      continue;
    }
    if (earliest == null || ms < earliest) {
      earliest = ms;
      hostId = userId;
    }
  }
  return hostId || null;
}

function isImageAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") return false;
  const type = String(
    attachment.content_type || attachment.contentType || ""
  )
    .trim()
    .toLowerCase();
  if (type.startsWith("video/") || type.startsWith("audio/")) return false;
  if (type.startsWith("image/")) return true;
  const name = String(attachment.filename || attachment.name || "");
  return IMAGE_FILENAME.test(name);
}

function attachmentImageUrl(attachment) {
  const url =
    attachment?.url || attachment?.proxy_url || attachment?.proxyURL || "";
  return typeof url === "string" && url.trim() ? url.trim() : "";
}

function attachmentDisplayName(attachment) {
  const raw = String(attachment?.filename || attachment?.name || "").trim();
  if (!raw) return "Host image";
  const stripped = raw.replace(/\.[^.]+$/, "");
  return stripped || raw;
}

function messageAuthorId(message) {
  return String(
    message?.author?.id || message?.author_id || message?.user?.id || ""
  ).trim();
}

function messageSortKey(message) {
  const id = String(message?.id || "").trim();
  if (/^\d{17,20}$/.test(id)) return id;
  const ms = parseTimestampMs(message?.timestamp || message?.createdTimestamp);
  if (ms == null) return "";
  return String(ms).padStart(20, "0");
}

function hostBoardCardFromAttachment(message, attachment) {
  const url = attachmentImageUrl(attachment);
  if (!url) return null;
  const messageId = String(message?.id || "").trim() || "message";
  const attachmentId = String(attachment?.id || "").trim() || attachmentDisplayName(attachment);
  return {
    id: `host-image:${messageId}:${attachmentId}`,
    name: attachmentDisplayName(attachment),
    url,
  };
}

function imageCardsFromMessage(message) {
  const cards = [];
  for (const attachment of asItemList(message?.attachments)) {
    if (!isImageAttachment(attachment)) continue;
    const card = hostBoardCardFromAttachment(message, attachment);
    if (card) cards.push(card);
    if (cards.length >= MAX_HOST_BOARD_IMAGES) break;
  }
  return cards;
}

function hostBoardImagesFromMessages(messages, hostUserId) {
  const hostId = String(hostUserId || "").trim();
  if (!hostId) return [];
  const list = asItemList(messages)
    .filter((message) => message && typeof message === "object")
    .sort((a, b) => messageSortKey(b).localeCompare(messageSortKey(a)));
  for (const message of list) {
    if (messageAuthorId(message) !== hostId) continue;
    const cards = imageCardsFromMessage(message);
    if (cards.length) return cards;
  }
  return [];
}

async function collectHostBoardImages({ data, fetchPage } = {}) {
  if (!shouldUseHostBoardImages(data)) return [];
  const hostUserId = gameHostUserId(data);
  if (!hostUserId || typeof fetchPage !== "function") return [];
  const collected = [];
  let before = "";
  try {
    while (collected.length < HOST_IMAGE_MESSAGE_SCAN_MAX) {
      const remaining = HOST_IMAGE_MESSAGE_SCAN_MAX - collected.length;
      const page = await fetchPage({
        before: before || undefined,
        remaining,
      });
      if (!Array.isArray(page) || page.length === 0) break;
      collected.push(...page);
      const cards = hostBoardImagesFromMessages(collected, hostUserId);
      if (cards.length) return cards;
      const oldestId = String(page[page.length - 1]?.id || "").trim();
      if (!oldestId || page.length < HOST_IMAGE_MESSAGE_LIMIT || oldestId === before) {
        break;
      }
      before = oldestId;
    }
  } catch {
    return [];
  }
  return [];
}

async function loadHostBoardImages({ data, listMessages } = {}) {
  if (typeof listMessages !== "function") return [];
  return collectHostBoardImages({
    data,
    fetchPage: async ({ before } = {}) => (before ? [] : listMessages()),
  });
}

function hostImageMessagesPath(channelId, { before, limit } = {}) {
  const cid = String(channelId || "").trim();
  if (!cid) return "";
  const capped = Math.min(
    HOST_IMAGE_MESSAGE_LIMIT,
    Math.max(1, Number(limit) || HOST_IMAGE_MESSAGE_LIMIT)
  );
  const params = new URLSearchParams({ limit: String(capped) });
  const beforeId = String(before || "").trim();
  if (beforeId) params.set("before", beforeId);
  return `/channels/${encodeURIComponent(cid)}/messages?${params}`;
}

module.exports = {
  HOST_IMAGE_CACHE_TTL_MS,
  HOST_IMAGE_MESSAGE_LIMIT,
  HOST_IMAGE_MESSAGE_SCAN_MAX,
  MAX_HOST_BOARD_IMAGES,
  collectHostBoardImages,
  gameBoardHasCards,
  gameHostUserId,
  hostBoardImagesFromMessages,
  hostImageMessagesPath,
  isImageAttachment,
  loadHostBoardImages,
  shouldUseHostBoardImages,
};
