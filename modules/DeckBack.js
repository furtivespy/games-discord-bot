const DeckRecipeHelper = require("./DeckRecipeHelper");

const FIELD = "backUrl";
const ALIAS_FIELDS = ["cardBackUrl", "backImage"];
const CLEAR_VALUES = new Set(["", "clear", "none", "default"]);
const DEFAULT_LABEL = "the default deck back";
const IMAGE_URL_MAX = 2048;
const INVALID_MESSAGE =
  'Deck back URL must be a valid http or https URL, or "clear" to restore the default.';

function readBackUrl(source) {
  if (!source || typeof source !== "object") return null;
  for (const key of [FIELD, ...ALIAS_FIELDS]) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function parseBackUrlInput(raw) {
  if (raw == null) return { present: false };
  const trimmed = String(raw).trim();
  if (CLEAR_VALUES.has(trimmed.toLowerCase())) {
    return { present: true, backUrl: null, cleared: true };
  }
  if (!DeckRecipeHelper.isEmbedImageUrl(trimmed)) {
    return { present: true, error: INVALID_MESSAGE };
  }
  return { present: true, backUrl: trimmed, cleared: false };
}

function applyBackUrl(target, backUrl) {
  if (!target || typeof target !== "object") return;
  for (const key of ALIAS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      delete target[key];
    }
  }
  target[FIELD] = backUrl || null;
}

function describeBackUrl(backUrl) {
  return backUrl || DEFAULT_LABEL;
}

module.exports = {
  FIELD,
  DEFAULT_LABEL,
  IMAGE_URL_MAX,
  INVALID_MESSAGE,
  readBackUrl,
  parseBackUrlInput,
  applyBackUrl,
  describeBackUrl,
};
