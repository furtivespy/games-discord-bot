const { expect, test } = require("bun:test");
const { cloneDeep } = require("lodash");
const DeckRecipeHelper = require("../modules/DeckRecipeHelper");

function makeDeck(name = "Main") {
  return {
    name,
    allCards: [
      { id: "existing", name: "Old Card", origin: name, format: "A", description: "", type: "", suit: "", value: "", url: null },
    ],
    piles: {
      draw: {
        cards: [
          { id: "draw-1", name: "Draw Card", origin: name, format: "A" },
        ],
      },
      discard: {
        cards: [
          { id: "discard-1", name: "Discard Card", origin: name, format: "A" },
        ],
      },
    },
  };
}

test("addcard with copies=2 adds two unique cards to allCards and discard, not draw", () => {
  const deck = makeDeck();
  const drawBefore = cloneDeep(deck.piles.draw.cards);

  const added = DeckRecipeHelper.addRichCards(deck, {
    name: "Promo",
    url: "https://example.com/promo.png",
    type: "Event",
    description: "A promo card",
    format: "B",
  }, 2);

  expect(added).toHaveLength(2);
  expect(deck.allCards).toHaveLength(3);
  expect(deck.piles.discard.cards).toHaveLength(3);
  expect(deck.piles.draw.cards).toEqual(drawBefore);

  expect(added[0].id).not.toBe(added[1].id);
  expect(added[0].name).toBe("Promo");
  expect(added[0].origin).toBe("Main");
  expect(added[0].format).toBe("B");
  expect(added[0].url).toBe("https://example.com/promo.png");
  expect(added[0].type).toBe("Event");

  const recipeCards = deck.allCards.slice(-2);
  const discardCards = deck.piles.discard.cards.slice(-2);
  expect(recipeCards.map(c => c.id)).toEqual(added.map(c => c.id));
  expect(discardCards.map(c => c.id)).toEqual(added.map(c => c.id));
  expect(discardCards[0]).not.toBe(recipeCards[0]);
});

test("addlist 'A, B, C' adds three name-only format A cards to allCards and discard", () => {
  const deck = makeDeck();
  const drawBefore = cloneDeep(deck.piles.draw.cards);

  const added = DeckRecipeHelper.addCardsFromNameList(deck, "A, B, C");

  expect(added).toHaveLength(3);
  expect(added.map(c => c.name)).toEqual(["A", "B", "C"]);
  expect(added.every(c => c.format === "A")).toBe(true);
  expect(added.every(c => c.origin === "Main")).toBe(true);
  expect(added.every(c => !c.type && !c.suit && !c.value && !c.description)).toBe(true);
  expect(new Set(added.map(c => c.id)).size).toBe(3);

  expect(deck.allCards).toHaveLength(4);
  expect(deck.piles.discard.cards).toHaveLength(4);
  expect(deck.piles.draw.cards).toEqual(drawBefore);
  expect(deck.allCards.slice(-3).map(c => c.name)).toEqual(["A", "B", "C"]);
  expect(deck.piles.discard.cards.slice(-3).map(c => c.name)).toEqual(["A", "B", "C"]);
});

test("recipe add does not shuffle — draw pile stays untouched", () => {
  const deck = makeDeck();
  const drawRef = deck.piles.draw.cards;
  const drawBefore = cloneDeep(deck.piles.draw.cards);

  DeckRecipeHelper.addRichCards(deck, { name: "Solo" }, 1);
  DeckRecipeHelper.addCardsFromNameList(deck, "X, Y");

  expect(deck.piles.draw.cards).toBe(drawRef);
  expect(deck.piles.draw.cards).toEqual(drawBefore);
});
