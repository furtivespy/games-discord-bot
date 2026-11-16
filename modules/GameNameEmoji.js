const GoogleGemini = require("./GoogleGemini");

const DISCORD_CHANNEL_NAME_MAX = 100;
const DISCORD_CUSTOM_EMOJI_RE = /<a?:\w+:\d+>/g;
const SHORTCODE_RE = /:[a-zA-Z0-9_+-]+:/g;
const KEYCAP_RE = /^[\d#*]\uFE0F?\u20E3$/u;
const FLAG_RE = /^\p{Regional_Indicator}{2}$/u;
const DIGIT_VS16_RE = /^[\d#*]\uFE0F$/u;
const WRAPPER_RE = /^[\s"'`.,;:!?()[\]{}]+$/;

function graphemes(text) {
  if (typeof text !== "string" || !text) return [];
  return [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)].map(
    (part) => part.segment
  );
}

function logSkip(client, reason) {
  GoogleGemini.logGeminiSkip(client, "Game name emoji skipped:", reason);
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

function isSingleUnicodeEmoji(text) {
  if (typeof text !== "string") return false;
  const parts = graphemes(text.trim());
  return parts.length === 1 && isUnicodeEmoji(parts[0]);
}

function firstNonWhitespaceGrapheme(text) {
  for (const segment of graphemes(text)) {
    if (segment.trim()) return segment;
  }
  return "";
}

function extractUnicodeEmoji(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const stripped = trimmed
    .replace(DISCORD_CUSTOM_EMOJI_RE, " ")
    .replace(SHORTCODE_RE, " ");
  for (const segment of graphemes(stripped)) {
    if (!segment.trim() || WRAPPER_RE.test(segment)) continue;
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

function isWellFormedString(text) {
  return typeof text === "string" &&
    (typeof text.isWellFormed !== "function" || text.isWellFormed());
}

function truncateToUtf16Limit(text, maxUnits) {
  const value = String(text || "");
  if (maxUnits <= 0) return "";
  if (value.length <= maxUnits) return value;
  let out = "";
  for (const segment of graphemes(value)) {
    if (out.length + segment.length > maxUnits) break;
    out += segment;
  }
  return out;
}

function isValidChannelName(name) {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= DISCORD_CHANNEL_NAME_MAX &&
    isWellFormedString(name)
  );
}

function formatChannelName(gameName, emoji) {
  const sanitized = sanitizeGameName(gameName);
  const cleaned = truncateToUtf16Limit(sanitized, DISCORD_CHANNEL_NAME_MAX);
  if (!emoji || !isSingleUnicodeEmoji(emoji) || startsWithUnicodeEmoji(cleaned)) {
    return cleaned;
  }
  const prefix = `${emoji} `;
  const remaining = DISCORD_CHANNEL_NAME_MAX - prefix.length;
  if (remaining <= 0) return cleaned;
  return `${prefix}${truncateToUtf16Limit(sanitized, remaining)}`;
}

async function chooseForGame(client, gameName) {
  if (!hasGeminiKey(client)) return null;
  try {
    const gemini = GoogleGemini.createGeminiAI(client);
    const raw = await gemini.suggestGameEmoji(gameName);
    const emoji = extractUnicodeEmoji(raw);
    if (!emoji) {
      logSkip(client, "invalid model output");
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
  isSingleUnicodeEmoji,
  extractUnicodeEmoji,
  startsWithUnicodeEmoji,
  sanitizeGameName,
  truncateToLength: truncateToUtf16Limit,
  truncateToUtf16Limit,
  isValidChannelName,
  formatChannelName,
  chooseForGame,
  logSkip,
};
