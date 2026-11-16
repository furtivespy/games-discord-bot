const GoogleGemini = require("./GoogleGemini");

const DISCORD_CHANNEL_NAME_MAX = 100;
const DISCORD_CUSTOM_EMOJI_RE = /<a?:\w+:\d+>/g;
const SHORTCODE_RE = /:[a-zA-Z0-9_+-]+:/g;
const KEYCAP_RE = /^[\d#*]\uFE0F?\u20E3$/u;
const FLAG_RE = /^\p{Regional_Indicator}{2}$/u;
const DIGIT_VS16_RE = /^[\d#*]\uFE0F$/u;
const WRAPPER_RE = /^[\s"'`.,;:!?()[\]{}]+$/;

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

function graphemes(text) {
  if (typeof text !== "string" || !text) return [];
  return [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)].map(
    (part) => part.segment
  );
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

function truncateToLength(text, max) {
  if (typeof text !== "string" || max <= 0) return "";
  if (text.length <= max) return text;
  let end = 0;
  for (const segment of graphemes(text)) {
    if (end + segment.length > max) break;
    end += segment.length;
  }
  return text.slice(0, end);
}

function formatChannelName(gameName, emoji) {
  const cleaned = truncateToLength(
    sanitizeGameName(gameName),
    DISCORD_CHANNEL_NAME_MAX
  );
  if (!emoji || !isSingleUnicodeEmoji(emoji) || startsWithUnicodeEmoji(cleaned)) {
    return cleaned;
  }
  const prefix = `${emoji} `;
  const remaining = DISCORD_CHANNEL_NAME_MAX - prefix.length;
  if (remaining <= 0) return cleaned;
  return `${prefix}${truncateToLength(sanitizeGameName(gameName), remaining)}`;
}

async function chooseForGame(client, gameName) {
  if (!hasGeminiKey(client)) return null;
  try {
    const gemini = GoogleGemini.createGeminiAI(client);
    const raw = await gemini.suggestGameEmoji(gameName);
    const emoji = extractUnicodeEmoji(raw);
    if (!emoji) {
      const preview = String(raw ?? "").slice(0, 80);
      logSkip(client, `invalid model output: ${JSON.stringify(preview)}`);
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
  truncateToLength,
  formatChannelName,
  chooseForGame,
  logSkip,
};
