const { describe, expect, test } = require("bun:test");
const GameHelper = require("../modules/GlobalGameHelper");
const { createCard, createDeck, createPlayer } = require("./helpers/harness");

function gameDataWithDecks(decks) {
  return {
    decks,
    players: [createPlayer({ userId: "user-1", name: "Alice" })],
  };
}

describe("resolveDeckOption", () => {
  test("uses the only deck when the option is omitted", () => {
    const main = createDeck({
      name: "Main",
      draw: [createCard({ id: "a1", name: "Ace" })],
    });
    const result = GameHelper.resolveDeckOption(gameDataWithDecks([main]), null);
    expect(result).toEqual({ deck: main, unspecified: false });
  });

  test("uses the only deck even when a name is provided", () => {
    const main = createDeck({ name: "Main" });
    const result = GameHelper.resolveDeckOption(gameDataWithDecks([main]), "Other");
    expect(result.deck).toBe(main);
    expect(result.unspecified).toBe(false);
  });

  test("requires a name when several decks exist and the option is omitted", () => {
    const main = createDeck({ name: "Main" });
    const reserve = createDeck({ name: "Reserve" });
    const result = GameHelper.resolveDeckOption(gameDataWithDecks([main, reserve]), null);
    expect(result).toEqual({ deck: null, unspecified: true });
  });

  test("finds a named deck among several", () => {
    const main = createDeck({ name: "Main" });
    const reserve = createDeck({ name: "Reserve" });
    const result = GameHelper.resolveDeckOption(gameDataWithDecks([main, reserve]), "Reserve");
    expect(result).toEqual({ deck: reserve, unspecified: false });
  });

  test("does not treat a missing name as a player-owned deck", () => {
    const playerDeck = createDeck({ name: "Alice" });
    playerDeck.id = "user-1";
    const supply = createDeck({ name: "Supply" });
    const result = GameHelper.resolveDeckOption(
      gameDataWithDecks([playerDeck, supply]),
      null
    );
    expect(result).toEqual({ deck: null, unspecified: true });
    expect(GameHelper.getSpecificDeck(gameDataWithDecks([playerDeck, supply]), null, "user-1")).toBe(
      playerDeck
    );
  });

  test("returns not found for an unknown name among several decks", () => {
    const result = GameHelper.resolveDeckOption(
      gameDataWithDecks([createDeck({ name: "Main" }), createDeck({ name: "Reserve" })]),
      "Missing"
    );
    expect(result).toEqual({ deck: null, unspecified: false });
  });
});
