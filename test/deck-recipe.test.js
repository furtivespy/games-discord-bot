const { expect, test } = require("bun:test");
const { cloneDeep, shuffle, remove } = require("lodash");
const { EmbedBuilder } = require("discord.js");
const DeckRecipeHelper = require("../modules/DeckRecipeHelper");
const GameDB = require("../db/anygame");
const Formatter = require("../modules/GameFormatter");
const Shuffle = require("../subcommands/cards/shuffle");

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

test("isEmbedImageUrl accepts http and https URLs and rejects malformed values", () => {
  expect(DeckRecipeHelper.isEmbedImageUrl("https://example.com/promo.png")).toBe(true);
  expect(DeckRecipeHelper.isEmbedImageUrl("http://example.com/card.jpg")).toBe(true);
  expect(DeckRecipeHelper.isEmbedImageUrl("not-a-url")).toBe(false);
  expect(DeckRecipeHelper.isEmbedImageUrl("ftp://example.com/image.png")).toBe(false);
  expect(DeckRecipeHelper.isEmbedImageUrl("")).toBe(false);
  expect(DeckRecipeHelper.isEmbedImageUrl("   ")).toBe(false);
});

test("parseNameList matches custom-csv comma splitting and drops empty names", () => {
  expect(DeckRecipeHelper.parseNameList("A, B, C")).toEqual(["A", "B", "C"]);
  expect(DeckRecipeHelper.parseNameList("  Fox, , Bear  , Elk")).toEqual(["Fox", "Bear", "Elk"]);
  expect(DeckRecipeHelper.parseNameList("   ,  ,")).toEqual([]);
  expect(DeckRecipeHelper.parseNameList(null)).toEqual([]);
});

test("copies above 50 are clamped and omitted format defaults to A", () => {
  const deck = makeDeck();
  const added = DeckRecipeHelper.addRichCards(deck, { name: "Token" }, 999);
  expect(added).toHaveLength(50);
  expect(added.every(card => card.format === "A")).toBe(true);
  expect(deck.allCards).toHaveLength(51);
  expect(deck.piles.discard.cards).toHaveLength(51);
  expect(deck.piles.draw.cards).toHaveLength(1);
});

test("addlist reply stays within Discord's 2000-character content limit", () => {
  const names = Array.from({ length: 400 }, (_, i) => `Card${String(i).padStart(3, "0")}`);
  const content = DeckRecipeHelper.formatAddListContent("Alice", "Main", names);
  expect(content.length).toBeLessThanOrEqual(DeckRecipeHelper.DISCORD_CONTENT_MAX);
  expect(content.startsWith("Alice added 400 card(s) to Main")).toBe(true);
  expect(content).toContain("too long to display");
});

test("addlist reply includes names when they fit", () => {
  const content = DeckRecipeHelper.formatAddListContent("Alice", "Main", ["A", "B", "C"]);
  expect(content).toBe("Alice added 3 card(s) to Main: A, B, C");
  expect(content.length).toBeLessThanOrEqual(2000);
});

test("addcard reply includes who/what/how many and stays sendable for long names", () => {
  const short = DeckRecipeHelper.formatAddCardContent("Alice", "Main", [{ name: "Promo" }, { name: "Promo" }]);
  expect(short).toBe("Alice added 2 card(s) \"Promo\" to Main");

  const longName = "X".repeat(2500);
  const clipped = DeckRecipeHelper.formatAddCardContent("Alice", "Main", [{ name: longName }]);
  expect(clipped.length).toBeLessThanOrEqual(2000);
  expect(clipped).toBe("Alice added 1 card(s) to Main");
});

test("Formatter.oneCard accepts an https image URL used by addcard", () => {
  const embed = Formatter.oneCard({
    name: "Promo",
    format: "A",
    description: "A promo card",
    type: "",
    url: "https://example.com/promo.png",
  });
  expect(embed).toBeInstanceOf(EmbedBuilder);
  expect(embed.data.image.url).toBe("https://example.com/promo.png");
});

test("buildAddCardEmbeds skips a broken oneCard embed instead of throwing", () => {
  const gameData = { name: "Test Game", decks: [makeDeck()] };
  const embeds = DeckRecipeHelper.buildAddCardEmbeds(gameData, {
    name: "Bad",
    format: "A",
    description: "",
    type: "",
    url: "not-a-url",
  });
  expect(Array.isArray(embeds)).toBe(true);
  expect(embeds.length).toBeGreaterThanOrEqual(1);
});

test("editReplyAfterSave does not throw after persist if the full reply is rejected", async () => {
  const calls = [];
  const interaction = {
    editReply: async (payload) => {
      calls.push(payload);
      if (payload.embeds) {
        throw new Error("Invalid URL");
      }
    },
  };

  await DeckRecipeHelper.editReplyAfterSave(interaction, {
    content: "Alice added 1 card(s) \"Promo\" to Main",
    embeds: [{ fake: true }],
  });

  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual({ content: "Alice added 1 card(s) \"Promo\" to Main" });
});

test("recipe editor flow: add to discard, shuffle into draw, recall includes allCards, prune can remove", () => {
  const deck = Object.assign({}, cloneDeep(GameDB.defaultDeck), { name: "Main" });
  deck.allCards = GameDB.createCardFromStrList("Main", "Ace, King".split(",").map(card => card.trim()));
  deck.piles.draw.cards = cloneDeep(shuffle(deck.allCards));

  const drawCountBefore = deck.piles.draw.cards.length;
  const recipeCountBefore = deck.allCards.length;

  const promo = DeckRecipeHelper.addRichCards(deck, {
    name: "Promo",
    url: "https://example.com/promo.png",
    format: "A",
  }, 1);
  DeckRecipeHelper.addCardsFromNameList(deck, "Fox, Bear");

  expect(deck.allCards).toHaveLength(recipeCountBefore + 3);
  expect(deck.piles.discard.cards.map(card => card.name)).toEqual(["Promo", "Fox", "Bear"]);
  expect(deck.piles.draw.cards).toHaveLength(drawCountBefore);

  Shuffle.DoShuffle(deck);
  expect(deck.piles.discard.cards).toHaveLength(0);
  const shuffledNames = deck.piles.draw.cards.map(card => card.name);
  expect(shuffledNames).toContain("Promo");
  expect(shuffledNames).toContain("Fox");
  expect(shuffledNames).toContain("Bear");
  expect(shuffledNames).toContain("Ace");

  deck.piles.discard.cards = [];
  deck.piles.draw.cards = cloneDeep(shuffle(deck.allCards));
  expect(deck.piles.draw.cards).toHaveLength(deck.allCards.length);
  expect(deck.piles.draw.cards.map(card => card.name)).toContain("Promo");

  remove(deck.allCards, card => card.id === promo[0].id);
  deck.piles.discard.cards = [];
  deck.piles.draw.cards = cloneDeep(shuffle(deck.allCards));
  expect(deck.piles.draw.cards.map(card => card.name)).not.toContain("Promo");
  expect(deck.allCards.map(card => card.name)).toEqual(expect.arrayContaining(["Ace", "King", "Fox", "Bear"]));
});
