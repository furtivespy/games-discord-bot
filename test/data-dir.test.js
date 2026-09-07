const { describe, expect, test } = require("bun:test");
const path = require("path");
const { isInContainer, resolveDataDir } = require("../db/dataDir.js");

function withEnv(overrides, run) {
  const keys = Object.keys(overrides);
  const previous = {};
  for (const key of keys) {
    previous[key] = process.env[key];
    const value = overrides[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return run();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

describe("isInContainer", () => {
  test("is false when unset (local runs)", () => {
    withEnv({ IS_IN_CONTAINER: undefined }, () => {
      expect(isInContainer()).toBe(false);
    });
  });

  test('is true only for the exact string "true"', () => {
    withEnv({ IS_IN_CONTAINER: "true" }, () => {
      expect(isInContainer()).toBe(true);
    });
    withEnv({ IS_IN_CONTAINER: "1" }, () => {
      expect(isInContainer()).toBe(false);
    });
    withEnv({ IS_IN_CONTAINER: "True" }, () => {
      expect(isInContainer()).toBe(false);
    });
  });
});

describe("resolveDataDir", () => {
  test("uses the mounted /data path in a container", () => {
    withEnv(
      { IS_IN_CONTAINER: "true", GAMEBOT_DATA_DIR: "/tmp/should-not-win" },
      () => {
        expect(resolveDataDir()).toBe("/data");
      }
    );
  });

  test("uses GAMEBOT_DATA_DIR when running locally", () => {
    withEnv(
      { IS_IN_CONTAINER: undefined, GAMEBOT_DATA_DIR: "/tmp/gamebot-data" },
      () => {
        expect(resolveDataDir()).toBe(path.resolve("/tmp/gamebot-data"));
      }
    );
  });

  test("defaults to ./data when running locally without GAMEBOT_DATA_DIR", () => {
    withEnv(
      { IS_IN_CONTAINER: undefined, GAMEBOT_DATA_DIR: undefined },
      () => {
        expect(resolveDataDir()).toBe(path.resolve("./data"));
      }
    );
  });
});
