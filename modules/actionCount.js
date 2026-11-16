"use strict";

const shared = require("./visualActionShared.json");

const ACTION_COUNT_MIN = shared.ACTION_COUNT_MIN;
const ACTION_COUNT_MAX = shared.ACTION_COUNT_MAX;
const DEFAULT_ACTION_COUNT = shared.DEFAULT_ACTION_COUNT;
const INVALID_COUNT_MESSAGE = shared.ACTION_ERROR_MESSAGES.invalid_count;

function parseActionCount(value) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(n) || n < ACTION_COUNT_MIN || n > ACTION_COUNT_MAX) {
    return null;
  }
  return n;
}

module.exports = {
  ACTION_COUNT_MAX,
  ACTION_COUNT_MIN,
  DEFAULT_ACTION_COUNT,
  INVALID_COUNT_MESSAGE,
  parseActionCount,
};
