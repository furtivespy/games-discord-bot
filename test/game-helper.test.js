const { describe, expect, test } = require("bun:test");
const GameHelper = require("../modules/GlobalGameHelper");

describe("GameHelper.shufflePlayerOrder", () => {
  test("copies the list so a mutating shuffleFn cannot change the caller", () => {
    const players = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const ordered = GameHelper.shufflePlayerOrder(players, (list) => {
      list.push({ id: "mutated" });
      list.reverse();
      return list;
    });
    expect(ordered.map((player) => player.id)).toEqual([
      "mutated",
      "c",
      "b",
      "a",
    ]);
    expect(players.map((player) => player.id)).toEqual(["a", "b", "c"]);
  });

  test("default shuffle is a lodash permutation and is not a no-op copy", () => {
    const players = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id }));
    const snapshot = players.map((player) => player.id);
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const ordered = GameHelper.shufflePlayerOrder(players);
      expect(ordered.map((player) => player.id).sort()).toEqual(
        [...snapshot].sort()
      );
      expect(players.map((player) => player.id)).toEqual(snapshot);
      expect(ordered).not.toBe(players);
      seen.add(ordered.map((player) => player.id).join(","));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test("returns an empty array for missing input", () => {
    expect(GameHelper.shufflePlayerOrder(null)).toEqual([]);
    expect(GameHelper.shufflePlayerOrder()).toEqual([]);
  });
});
