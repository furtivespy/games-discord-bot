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

  const result = DeckRecipeHelper.addCardsFromCustomList(deck, "A, B, C");

  expect(result.ok).toBe(true);
  expect(result.mode).toBe("names");
  const added = result.added;
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

test("headered CSV with url + copies=2 creates two cards with that url in allCards and discard", () => {
  const deck = makeDeck();
  const drawBefore = cloneDeep(deck.piles.draw.cards);
  const csv = [
    "name,url,copies",
    "Promo,https://example.com/promo.png,2",
  ].join("\n");

  const result = DeckRecipeHelper.addCardsFromCustomList(deck, csv);

  expect(result.ok).toBe(true);
  expect(result.mode).toBe("csv");
  expect(result.added).toHaveLength(2);
  expect(result.added[0].id).not.toBe(result.added[1].id);
  expect(result.added.every(card => card.name === "Promo")).toBe(true);
  expect(result.added.every(card => card.url === "https://example.com/promo.png")).toBe(true);
  expect(result.added.every(card => card.format === "A")).toBe(true);
  expect(result.added.every(card => card.origin === "Main")).toBe(true);

  expect(deck.allCards).toHaveLength(3);
  expect(deck.piles.discard.cards).toHaveLength(3);
  expect(deck.piles.draw.cards).toEqual(drawBefore);
  expect(deck.allCards.slice(-2).map(card => card.url)).toEqual([
    "https://example.com/promo.png",
    "https://example.com/promo.png",
  ]);
  expect(deck.piles.discard.cards.slice(-2).map(card => card.url)).toEqual([
    "https://example.com/promo.png",
    "https://example.com/promo.png",
  ]);
});

test("missing CSV name column does not write any cards", () => {
  const deck = makeDeck();
  const before = cloneDeep(deck);
  const csv = [
    "url,copies",
    "https://example.com/promo.png,2",
  ].join("\n");

  const result = DeckRecipeHelper.addCardsFromCustomList(deck, csv);

  expect(result.ok).toBe(false);
  expect(result.error).toContain("name");
  expect(result.error.toLowerCase()).toContain("no cards were added");
  expect(deck).toEqual(before);
});

test("missing name on a CSV data row does not write any cards", () => {
  const deck = makeDeck();
  const before = cloneDeep(deck);
  const csv = [
    "name,url",
    "Ace,https://example.com/ace.png",
    ",https://example.com/blank.png",
  ].join("\n");

  const result = DeckRecipeHelper.addCardsFromCustomList(deck, csv);

  expect(result.ok).toBe(false);
  expect(result.error).toContain("row 3");
  expect(result.error.toLowerCase()).toContain("name");
  expect(result.error.toLowerCase()).toContain("no cards were added");
  expect(deck).toEqual(before);
});

test("unknown CSV columns error instead of being ignored, with no partial write", () => {
  const deck = makeDeck();
  const before = cloneDeep(deck);
  const csv = [
    "name,url,color",
    "Ace,https://example.com/ace.png,red",
  ].join("\n");

  const result = DeckRecipeHelper.addCardsFromCustomList(deck, csv);

  expect(result.ok).toBe(false);
  expect(result.error).toContain("color");
  expect(result.error).toContain("Allowed columns");
  expect(deck).toEqual(before);
});

test("CSV detection requires a newline and a name header; otherwise names-only parsing stays", () => {
  expect(DeckRecipeHelper.looksLikeHeaderedCsv("Ace, King, Queen")).toBe(false);
  expect(DeckRecipeHelper.looksLikeHeaderedCsv("name,url,Ace,https://example.com/ace.png")).toBe(false);
  expect(DeckRecipeHelper.looksLikeHeaderedCsv("Ace, King\nQueen")).toBe(false);
  expect(DeckRecipeHelper.looksLikeHeaderedCsv("name,url\nAce,https://example.com/ace.png")).toBe(true);
  expect(DeckRecipeHelper.looksLikeHeaderedCsv("Name, URL\nAce,https://example.com/ace.png")).toBe(true);
  expect(DeckRecipeHelper.looksLikeHeaderedCsv("url,copies\nhttps://example.com/promo.png,2")).toBe(true);

  const deck = makeDeck();
  const namesOnly = DeckRecipeHelper.addCardsFromCustomList(deck, "name, King, Queen");
  expect(namesOnly.ok).toBe(true);
  expect(namesOnly.mode).toBe("names");
  expect(namesOnly.added.map(card => card.name)).toEqual(["name", "King", "Queen"]);
});

test("headered CSV accepts extra fields, quoted commas, and defaults copies/format", () => {
  const deck = makeDeck();
  const csv = [
    "NAME,type,suit,value,description,format",
    'Ace,Spades,Hearts,14,"A, special card",C',
    "King,Spades,Hearts,13,,",
  ].join("\n");

  const result = DeckRecipeHelper.addCardsFromCustomList(deck, csv);

  expect(result.ok).toBe(true);
  expect(result.added).toHaveLength(2);
  expect(result.added[0]).toMatchObject({
    name: "Ace",
    type: "Spades",
    suit: "Hearts",
    value: "14",
    description: "A, special card",
    format: "C",
  });
  expect(result.added[1]).toMatchObject({
    name: "King",
    format: "A",
    description: "",
  });
});

test("invalid CSV url or format fails before writing cards", () => {
  const deck = makeDeck();
  const before = cloneDeep(deck);

  const badUrl = DeckRecipeHelper.addCardsFromCustomList(deck, "name,url\nAce,not-a-url");
  expect(badUrl.ok).toBe(false);
  expect(badUrl.error).toContain(DeckRecipeHelper.INVALID_IMAGE_URL_MESSAGE);
  expect(deck).toEqual(before);

  const badFormat = DeckRecipeHelper.addCardsFromCustomList(deck, "name,format\nAce,Z");
  expect(badFormat.ok).toBe(false);
  expect(badFormat.error).toContain("format");
  expect(deck).toEqual(before);
});

test("addlist option copy documents the 4000-character Discord limit", () => {
  expect(DeckRecipeHelper.DISCORD_STRING_OPTION_MAX).toBe(4000);
  expect(DeckRecipeHelper.ADDLIST_OPTION_DESCRIPTION).toContain("4000");
  expect(DeckRecipeHelper.ADDLIST_OPTION_DESCRIPTION.length).toBeLessThanOrEqual(100);
  expect(DeckRecipeHelper.ADDLIST_COMMAND_DESCRIPTION.length).toBeLessThanOrEqual(100);
  expect(DeckRecipeHelper.EMPTY_LIST_MESSAGE).toContain("4000");
  expect(DeckRecipeHelper.EMPTY_LIST_MESSAGE).toContain("addlist");
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

test("format A/B/C match the slash choice templates; suit is sort-only; value is shown only in C", () => {
  const sample = {
    name: "Ace",
    type: "Spades",
    suit: "Hearts",
    value: "14",
    description: "",
  };

  expect(Formatter.cardShortName({ ...sample, format: "A" })).toBe("Ace of Spades");
  expect(Formatter.cardShortName({ ...sample, format: "B" })).toBe("Spades: Ace");
  expect(Formatter.cardShortName({ ...sample, format: "C" })).toBe("14: Ace");

  for (const format of ["A", "B", "C"]) {
    expect(Formatter.cardShortName({ ...sample, format })).not.toContain("Hearts");
  }

  expect(Formatter.CARD_FORMAT_CHOICES.map((choice) => choice.name)).toEqual([
    "A - {name} of {type} (sort: suit hidden, value hidden)",
    "B - {type}: {name} (sort: suit hidden, value hidden)",
    "C - {value}: {name} (sort: suit hidden, value shown)",
  ]);
  expect(Formatter.HAND_SORT_KEYS).toEqual(["suit", "value", "name"]);
  expect(Formatter.CARD_FORMAT_OPTION_DESCRIPTION).toContain("suit");
  expect(Formatter.CARD_FORMAT_OPTION_DESCRIPTION).toContain("value");
  expect(Formatter.CARD_FORMAT_OPTION_DESCRIPTION.toLowerCase()).toContain("shown in c");
  expect(Formatter.CARD_FORMAT_OPTION_DESCRIPTION.length).toBeLessThanOrEqual(
    Formatter.DISCORD_OPTION_DESCRIPTION_MAX
  );
  for (const choice of Formatter.CARD_FORMAT_CHOICES) {
    expect(choice.name.length).toBeLessThanOrEqual(Formatter.DISCORD_CHOICE_NAME_MAX);
    expect(choice.name).toContain("sort:");
  }
});

test("cardSort orders by suit, then value, then name", () => {
  const sorted = Formatter.cardSort([
    { name: "Beta", suit: "B", value: "1" },
    { name: "Alpha", suit: "A", value: "2" },
    { name: "Gamma", suit: "A", value: "1" },
    { name: "Delta", suit: "A", value: "1" },
  ]);
  expect(sorted.map((card) => card.name)).toEqual(["Delta", "Gamma", "Alpha", "Beta"]);
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
