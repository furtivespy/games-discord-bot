const { describe, expect, test } = require("bun:test");
const CardMoves = require("../modules/gameLogic/cardMoves");
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
    expect(result.drawnCount).toBe(2);
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

describe("cardMoves playFromHand", () => {
  test("defaults to discard and records a play, matching /cards hand play", () => {
    const card = createCard({ id: "play-1", name: "Ace", origin: "Main" });
    const gameData = gameWithDeck({ draw: [], hand: [card] });
    const result = CardMoves.playFromHand(gameData, {
      player: gameData.players[0],
      cardId: "play-1",
      actor,
    });
    expect(result.ok).toBe(true);
    expect(result.destinationName).toBe("discard pile");
    expect(result.content).toBe("Alice has Played to discard pile:");
    expect(gameData.players[0].hands.main).toEqual([]);
    expect(gameData.decks[0].piles.discard.cards.map((item) => item.id)).toEqual(["play-1"]);
    expect(gameData.history.at(-1).summary).toBe("Alice played Ace to discard pile");
    expect(gameData.history.at(-1).action).toEqual({ category: "card", type: "play" });
  });

  test("playToPlayArea sends the card to the player's play area", () => {
    const card = createCard({ id: "play-2", name: "King", origin: "Main" });
    const gameData = gameWithDeck({ draw: [], hand: [card] });
    gameData.playToPlayArea = true;
    const result = CardMoves.playFromHand(gameData, {
      player: gameData.players[0],
      cardId: "play-2",
      actor,
    });
    expect(result.ok).toBe(true);
    expect(result.actualDestination).toBe("playarea");
    expect(gameData.players[0].playArea.map((item) => item.id)).toEqual(["play-2"]);
    expect(gameData.players[0].hands.main).toEqual([]);
  });

  test("missing card leaves the hand unchanged", () => {
    const card = createCard({ id: "keep", name: "Ace", origin: "Main" });
    const gameData = gameWithDeck({ draw: [], hand: [card] });
    const result = CardMoves.playFromHand(gameData, {
      player: gameData.players[0],
      cardId: "missing",
      actor,
    });
    expect(result).toMatchObject({ ok: false, error: "card_not_in_hand" });
    expect(gameData.players[0].hands.main.map((item) => item.id)).toEqual(["keep"]);
  });

  test("unknown origin returns the card to hand", () => {
    const card = createCard({ id: "orphan", name: "Ace", origin: "MissingDeck" });
    const gameData = gameWithDeck({ draw: [], hand: [card] });
    const result = CardMoves.playFromHand(gameData, {
      player: gameData.players[0],
      cardId: "orphan",
      actor,
    });
    expect(result).toMatchObject({ ok: false, error: "discard_pile_missing" });
    expect(gameData.players[0].hands.main.map((item) => item.id)).toEqual(["orphan"]);
    expect(gameData.decks[0].piles.discard.cards).toEqual([]);
  });
});

describe("cardMoves discardFromHand", () => {
  test("moves the card to the origin discard pile without naming it publicly", () => {
    const card = createCard({ id: "disc-1", name: "Village", origin: "Main" });
    const gameData = gameWithDeck({ draw: [], hand: [card] });
    const result = CardMoves.discardFromHand(gameData, {
      player: gameData.players[0],
      cardId: "disc-1",
      actor,
    });
    expect(result.ok).toBe(true);
    expect(result.content).toBe("Alice has Discarded a card");
    expect(result.privateContent).toBe("You discarded Village.");
    expect(gameData.players[0].hands.main).toEqual([]);
    expect(gameData.decks[0].piles.discard.cards.map((item) => item.id)).toEqual(["disc-1"]);
    expect(gameData.history.at(-1).summary).toBe("Alice discarded a card to Main discard pile");
    expect(gameData.history.at(-1).details.cardName).toBeUndefined();
  });
});

describe("cardMoves showFromHand", () => {
  test("records a reveal and leaves the card in hand", () => {
    const ace = createCard({ id: "ace-1", name: "Ace", origin: "Main" });
    const king = createCard({ id: "king-1", name: "King", origin: "Main" });
    const gameData = gameWithDeck({ draw: [], hand: [ace, king] });
    const result = CardMoves.showFromHand(gameData, {
      player: gameData.players[0],
      cardId: "ace-1",
      actor,
    });
    expect(result.ok).toBe(true);
    expect(result.content).toBe("Showing a card:");
    expect(result.card.id).toBe("ace-1");
    expect(gameData.players[0].hands.main.map((item) => item.id)).toEqual(["ace-1", "king-1"]);
    expect(gameData.history.at(-1).summary).toBe("Alice revealed Ace from hand");
    expect(gameData.history.at(-1).action).toEqual({ category: "card", type: "reveal" });
  });
});
