const GoogleGemini = require("./GoogleGemini");

const DISCORD_CHANNEL_NAME_MAX = 100;
const DISCORD_CUSTOM_EMOJI_RE = /<a?:\w+:\d+>/;
const SHORTCODE_RE = /:[a-zA-Z0-9_+-]+:/;
const KEYCAP_RE = /^[\d#*]\uFE0F?\u20E3$/u;
const FLAG_RE = /^\p{Regional_Indicator}{2}$/u;
const DIGIT_VS16_RE = /^[\d#*]\uFE0F$/u;

function logSkip(client, reason) {
  const message =
    reason instanceof Error
      ? reason.message || String(reason)
      : String(reason || "unknown");
  const line = `Game name emoji skipped: ${message}`;
  if (typeof client?.logger?.warn === "function") {
    client.logger.warn(line);
  } else if (typeof client?.logger?.log === "function") {
    client.logger.log(line, "warn");
  } else {
    console.warn(line);
  }
}

function hasGeminiKey(client) {
  const key = client?.config?.geminiKey;
  return typeof key === "string" && key.trim().length > 0;
}

function isUnicodeEmoji(grapheme) {
  if (typeof grapheme !== "string" || grapheme.length === 0) return false;
  if (KEYCAP_RE.test(grapheme) || FLAG_RE.test(grapheme)) return true;
  if (/[A-Za-z]/.test(grapheme)) return false;
  if (/\p{Extended_Pictographic}/u.test(grapheme)) return true;
  if (DIGIT_VS16_RE.test(grapheme)) return false;
  return /\p{Emoji}/u.test(grapheme) && grapheme.includes("\uFE0F");
}

function firstNonWhitespaceGrapheme(text) {
  if (typeof text !== "string" || !text) return "";
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  for (const { segment } of segmenter.segment(text)) {
    if (segment.trim()) return segment;
  }
  return "";
}

function extractUnicodeEmoji(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (DISCORD_CUSTOM_EMOJI_RE.test(trimmed) || SHORTCODE_RE.test(trimmed)) {
    return null;
  }
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  for (const { segment } of segmenter.segment(trimmed)) {
    if (!segment.trim()) continue;
    if (/^[\s"'`.,;:!?()[\]{}]+$/.test(segment)) continue;
    if (isUnicodeEmoji(segment)) return segment;
  }
  return null;
}

function startsWithUnicodeEmoji(text) {
  return isUnicodeEmoji(firstNonWhitespaceGrapheme(String(text || "")));
}

function sanitizeGameName(name) {
  return String(name || "Game").replace(/[\r\n]+/g, " ").trim() || "Game";
}

function formatChannelName(gameName, emoji) {
  const cleaned = sanitizeGameName(gameName).slice(0, DISCORD_CHANNEL_NAME_MAX);
  if (!emoji || !isUnicodeEmoji(emoji) || startsWithUnicodeEmoji(cleaned)) {
    return cleaned;
  }
  const prefix = `${emoji} `;
  const remaining = DISCORD_CHANNEL_NAME_MAX - prefix.length;
  if (remaining <= 0) return cleaned;
  return `${prefix}${sanitizeGameName(gameName).slice(0, remaining)}`;
}

async function chooseForGame(client, gameName) {
  if (!hasGeminiKey(client)) return null;
  try {
    const gemini = GoogleGemini.createGeminiAI(client);
    const raw = await gemini.suggestGameEmoji(gameName);
    const emoji = extractUnicodeEmoji(raw);
    if (!emoji) {
      logSkip(client, `invalid model output: ${JSON.stringify(raw)}`);
      return null;
    }
    return emoji;
  } catch (error) {
    logSkip(client, error);
    return null;
  }
}

module.exports = {
  DISCORD_CHANNEL_NAME_MAX,
  hasGeminiKey,
  isUnicodeEmoji,
  extractUnicodeEmoji,
  startsWithUnicodeEmoji,
  sanitizeGameName,
  formatChannelName,
  chooseForGame,
  logSkip,
};
