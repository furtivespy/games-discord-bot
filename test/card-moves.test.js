const { describe, expect, test } = require("bun:test");
const CardMoves = require("../modules/cardMoves");
const {
  createActiveGame,
  createCard,
  createDeck,
  createPlayer,
} = require("./helpers/harness");

function gameWithDeck({
  draw = [createCard({ id: "ace", name: "Ace" }), createCard({ id: "king", name: "King" })],
  discard = [],
  hand = [],
} = {}) {
  return createActiveGame({
    players: [
      createPlayer({
        userId: "user-1",
        name: "Alice",
        order: 0,
        hands: { main: hand, played: [], passed: [], received: [], simultaneous: [] },
      }),
      createPlayer({ userId: "user-2", name: "Bob", order: 1 }),
    ],
    decks: [createDeck({ name: "Main", draw, discard })],
  });
}

const actor = { id: "user-1", username: "alice", displayName: "Alice" };

describe("cardMoves dealMultiple", () => {
  test("deals count cards to each player and records history", () => {
    const gameData = gameWithDeck({
      draw: [
        createCard({ id: "c1", name: "One" }),
        createCard({ id: "c2", name: "Two" }),
        createCard({ id: "c3", name: "Three" }),
        createCard({ id: "c4", name: "Four" }),
      ],
    });
    const result = CardMoves.dealMultiple(gameData, {
      deck: gameData.decks[0],
      count: 2,
      actor,
    });
    expect(result.ok).toBe(true);
    expect(result.dealCount).toBe(4);
    expect(result.content).toBe("Dealt out a total of 4 cards from Main.");
    expect(gameData.players[0].hands.main.map((card) => card.name)).toEqual(["One", "Three"]);
    expect(gameData.players[1].hands.main.map((card) => card.name)).toEqual(["Two", "Four"]);
    expect(gameData.history.at(-1).summary).toBe(
      "Alice dealt 4 cards from Main to all players"
    );
    expect(gameData.history.at(-1).action).toEqual({ category: "card", type: "deal" });
  });

  test("empty deck returns the slash-command message and does not persist history", () => {
    const gameData = gameWithDeck({ draw: [], discard: [] });
    const result = CardMoves.dealMultiple(gameData, {
      deck: gameData.decks[0],
      count: 1,
      actor,
    });
    expect(result).toMatchObject({
      ok: false,
      error: "no_cards_to_deal",
      content: "No cards to deal.",
    });
    expect(gameData.history).toEqual([]);
  });
});

describe("cardMoves drawMultiple", () => {
  test("draws count cards into the player's hand and records history", () => {
    const gameData = gameWithDeck({
      draw: [
        createCard({ id: "c1", name: "One" }),
        createCard({ id: "c2", name: "Two" }),
        createCard({ id: "c3", name: "Three" }),
      ],
    });
    const result = CardMoves.drawMultiple(gameData, {
      deck: gameData.decks[0],
      count: 2,
      actor,
      player: gameData.players[0],
    });
    expect(result.ok).toBe(true);
    expect(result.dealCount).toBe(2);
    expect(result.content).toBe("Alice drew 2 cards from Main");
    expect(gameData.players[0].hands.main.map((card) => card.name)).toEqual(["One", "Two"]);
    expect(gameData.players[1].hands.main).toEqual([]);
    expect(gameData.history.at(-1).summary).toBe("Alice drew 2 cards from Main");
    expect(gameData.history.at(-1).action).toEqual({ category: "card", type: "draw" });
  });

  test("empty draw pile returns the slash-command message", () => {
    const gameData = gameWithDeck({ draw: [] });
    const result = CardMoves.drawMultiple(gameData, {
      deck: gameData.decks[0],
      count: 2,
      actor,
      player: gameData.players[0],
    });
    expect(result).toMatchObject({
      ok: false,
      error: "no_cards_in_draw",
      content: "No cards in draw pile",
    });
    expect(gameData.players[0].hands.main).toEqual([]);
  });
});
