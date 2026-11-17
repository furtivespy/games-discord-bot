const { describe, expect, test } = require("bun:test");
const PlayerScores = require("../modules/gameLogic/playerScores");
const {
  createActiveGame,
  createPlayer,
} = require("./helpers/harness");

const actor = { id: "user-1", username: "alice", displayName: "Alice" };

describe("gameLogic playerScores", () => {
  test("setPlayerScore overwrites one seated player and records /players score history", () => {
    const gameData = createActiveGame();
    const result = PlayerScores.setPlayerScore(gameData, {
      targetUserId: "user-2",
      score: "17",
      actor,
      actorDisplayName: "Alice",
      targetDisplayName: "Bob",
      targetUsername: "bob",
    });
    expect(result.ok).toBe(true);
    expect(gameData.players[0].score).toBe("");
    expect(gameData.players[1].score).toBe("17");
    expect(gameData.history.at(-1).summary).toBe("Alice set Bob's score to 17");
    expect(gameData.history.at(-1).action).toEqual({
      category: "player",
      type: "score",
    });
    expect(gameData.history.at(-1).details).toEqual({
      targetPlayer: { userId: "user-2", username: "bob" },
      oldScore: "",
      newScore: "17",
    });
  });

  test("setPlayerScore rejects a user who is not seated", () => {
    const gameData = createActiveGame();
    const result = PlayerScores.setPlayerScore(gameData, {
      targetUserId: "user-99",
      score: "5",
      actor,
      targetDisplayName: "Eve",
    });
    expect(result).toMatchObject({ ok: false, error: "not_a_player" });
    expect(gameData.history).toEqual([]);
  });

  test("applyPlayerScores matches scoreall-modal submit: skip empty and unchanged", () => {
    const gameData = createActiveGame({
      players: [
        createPlayer({ userId: "user-1", name: "Alice", order: 0, score: "10" }),
        createPlayer({ userId: "user-2", name: "Bob", order: 1, score: "7" }),
        createPlayer({ userId: "user-3", name: "Cara", order: 2, score: "" }),
      ],
    });
    const result = PlayerScores.applyPlayerScores(gameData, {
      scores: {
        "user-1": "10",
        "user-2": "12",
        "user-3": "",
      },
      actor,
      actorDisplayName: "Alice",
      playerNames: { "user-1": "Alice", "user-2": "Bob", "user-3": "Cara" },
    });
    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.content).toBe("Player scores updated successfully.");
    expect(gameData.players[0].score).toBe("10");
    expect(gameData.players[1].score).toBe("12");
    expect(gameData.players[2].score).toBe("");
    expect(gameData.history.at(-1).summary).toBe(
      "Alice updated player scores:\nBob's score changed from 7 to 12"
    );
    expect(gameData.history.at(-1).details.changes).toEqual([
      { playerName: "Bob", oldScore: "7", newScore: "12" },
    ]);
  });

  test("applyPlayerScores does not record history when nothing changed", () => {
    const gameData = createActiveGame({
      players: [
        createPlayer({ userId: "user-1", name: "Alice", order: 0, score: "3" }),
      ],
    });
    const result = PlayerScores.applyPlayerScores(gameData, {
      scores: { "user-1": "3" },
      actor,
    });
    expect(result.changed).toBe(false);
    expect(gameData.history).toEqual([]);
    expect(result.content).toBe("Player scores updated successfully.");
  });

  test("applyPlayerScores treats a missing old score as 0 in the history line", () => {
    const gameData = createActiveGame();
    const result = PlayerScores.applyPlayerScores(gameData, {
      scores: { "user-1": "8", "user-2": "2" },
      actor,
      actorDisplayName: "Alice",
      playerNames: { "user-1": "Alice", "user-2": "Bob" },
    });
    expect(result.changed).toBe(true);
    expect(gameData.history.at(-1).summary).toBe(
      "Alice updated player scores:\nAlice's score changed from 0 to 8\nBob's score changed from 0 to 2"
    );
  });

  test("applyPlayerScores only writes ids the client sent, so an untouched seat keeps a concurrent change", () => {
    const gameData = createActiveGame({
      players: [
        createPlayer({ userId: "user-1", name: "Alice", order: 0, score: "10" }),
        createPlayer({ userId: "user-2", name: "Bob", order: 1, score: "20" }),
      ],
    });
    const result = PlayerScores.applyPlayerScores(gameData, {
      scores: { "user-1": "21" },
      actor,
    });
    expect(result.changed).toBe(true);
    expect(gameData.players[0].score).toBe("21");
    expect(gameData.players[1].score).toBe("20");
    expect(gameData.history.at(-1).summary).toBe(
      "Alice updated player scores:\nAlice's score changed from 10 to 21"
    );
  });

  test("applyPlayerScores skips NaN, Infinity, and oversized text", () => {
    const gameData = createActiveGame({
      players: [
        createPlayer({ userId: "user-1", name: "Alice", order: 0, score: "10" }),
        createPlayer({ userId: "user-2", name: "Bob", order: 1, score: "7" }),
        createPlayer({ userId: "user-3", name: "Cara", order: 2, score: "3" }),
      ],
    });
    const result = PlayerScores.applyPlayerScores(gameData, {
      scores: {
        "user-1": Number.NaN,
        "user-2": Number.POSITIVE_INFINITY,
        "user-3": "1e309",
      },
      actor,
    });
    expect(result.changed).toBe(false);
    expect(gameData.players.map((player) => player.score)).toEqual(["10", "7", "3"]);
    expect(gameData.history).toEqual([]);

    const strings = PlayerScores.applyPlayerScores(gameData, {
      scores: {
        "user-1": "NaN",
        "user-2": "Infinity",
        "user-3": "x".repeat(PlayerScores.SCORE_MAX_LENGTH + 1),
      },
      actor,
    });
    expect(strings.changed).toBe(false);
    expect(gameData.players.map((player) => player.score)).toEqual(["10", "7", "3"]);
  });

  test("applyPlayerScores lets a recordMove failure surface instead of reporting success with no history", () => {
    const GameHelper = require("../modules/GlobalGameHelper");
    const gameData = createActiveGame();
    const original = GameHelper.recordMove;
    GameHelper.recordMove = () => {
      throw new Error("history down");
    };
    try {
      expect(() =>
        PlayerScores.applyPlayerScores(gameData, {
          scores: { "user-1": "8" },
          actor,
        })
      ).toThrow("history down");
      expect(gameData.players[0].score).toBe("8");
      expect(gameData.history).toEqual([]);
    } finally {
      GameHelper.recordMove = original;
    }
  });

  test("setPlayerScore still keeps the write if history recording fails", () => {
    const GameHelper = require("../modules/GlobalGameHelper");
    const gameData = createActiveGame();
    const original = GameHelper.recordMove;
    GameHelper.recordMove = () => {
      throw new Error("history down");
    };
    try {
      const result = PlayerScores.setPlayerScore(gameData, {
        targetUserId: "user-2",
        score: "17",
        actor,
        targetDisplayName: "Bob",
      });
      expect(result.ok).toBe(true);
      expect(gameData.players[1].score).toBe("17");
      expect(gameData.history).toEqual([]);
    } finally {
      GameHelper.recordMove = original;
    }
  });
});
