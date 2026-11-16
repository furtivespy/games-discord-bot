const { describe, expect, test } = require("bun:test");
const { trace } = require("@opentelemetry/api");
const gameDataMethods = require("../modules/gameDataMethods");

function createClient({ sqliteGame = null, legacyGame = null } = {}) {
  return Object.assign(
    {
      db: {
        getSpecificGameData: () => sqliteGame,
      },
      gamedata: {
        get: (key) => (key === "game-channel-1" ? legacyGame : null),
      },
      logger: { warn() {} },
    },
    gameDataMethods
  );
}

async function withCapturedSpan(run) {
  const originalGetTracer = trace.getTracer;
  const captured = {};
  trace.getTracer = () => ({
    startActiveSpan: (_name, fn) => {
      const span = {
        setAttribute(key, value) {
          captured[key] = value;
        },
        setAttributes(attrs) {
          Object.assign(captured, attrs);
        },
        recordException() {},
        setStatus() {},
        end() {},
      };
      return fn(span);
    },
  });
  try {
    return await run(captured);
  } finally {
    trace.getTracer = originalGetTracer;
  }
}

describe("getGameDataV2", () => {
  test("migrates a legacy-only Enmap game and reports real span attributes", async () => {
    const legacyGame = {
      name: "Legacy",
      players: [{ userId: "1" }],
    };
    const client = createClient({ sqliteGame: null, legacyGame });

    await withCapturedSpan(async (spanAttrs) => {
      const fromEnmap = client.getGameData("game-channel-1");
      expect(fromEnmap).not.toBeInstanceOf(Promise);
      expect(fromEnmap).toEqual(legacyGame);

      const result = await client.getGameDataV2("guild-1", "game", "channel-1");

      expect(result).not.toBeInstanceOf(Promise);
      expect(result.name).toBe("Legacy");
      expect(result.isdeleted).toBe(false);
      expect(result.players).toEqual([{ userId: "1" }]);
      expect(result.decks).toEqual([]);
      expect(spanAttrs["game.found"]).toBe(true);
      expect(spanAttrs["game.player_count"]).toBe(1);
      expect(spanAttrs["game.collection"]).toBe("game");
    });
  });
});
