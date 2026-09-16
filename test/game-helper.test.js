const { describe, expect, test } = require("bun:test");
const GameHelper = require("../modules/GlobalGameHelper");

describe("GameHelper.shufflePlayerOrder", () => {
  test("copies the list then applies the shuffle function", () => {
    const players = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const ordered = GameHelper.shufflePlayerOrder(players, (list) =>
      list.reverse()
    );
    expect(ordered.map((player) => player.id)).toEqual(["c", "b", "a"]);
    expect(players.map((player) => player.id)).toEqual(["a", "b", "c"]);
  });

  test("returns an empty array for missing input", () => {
    expect(GameHelper.shufflePlayerOrder(null)).toEqual([]);
    expect(GameHelper.shufflePlayerOrder()).toEqual([]);
  });
});
