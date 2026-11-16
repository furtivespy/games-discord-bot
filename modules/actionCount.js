"use strict";

const ACTION_COUNT_MIN = 1;
const ACTION_COUNT_MAX = 1000;
const DEFAULT_ACTION_COUNT = 1;

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
  parseActionCount,
};
