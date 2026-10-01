const DeckCatalog = require("../../db/deckCatalog.js");
const { OFFICIAL_SEED_IDS } = require("../../db/seedDeckCatalog.js");

const DISPLAY_NAMES = {
  standard: "Standard 52 Card Poker Deck",
  "brass-two": "Brass Birmingham - 2 Players",
};

function catalogCard(overrides = {}) {
  return {
    name: "Card",
    description: "",
    type: "",
    suit: "",
    value: "",
    url: null,
    format: "A",
    ...overrides,
  };
}

function standardPokerCards() {
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const suits = [
    { type: "♣", suit: "clubs" },
    { type: "♦", suit: "diamonds" },
    { type: "♥", suit: "hearts" },
    { type: "♠", suit: "spades" },
  ];
  const cards = [];
  for (const { type, suit } of suits) {
    ranks.forEach((name, index) => {
      cards.push(
        catalogCard({
          name,
          type,
          suit,
          value: String(index + 1),
          format: "A",
        })
      );
    });
  }
  return cards;
}

function nCards(count, format) {
  return Array.from({ length: count }, (_, index) =>
    catalogCard({
      name: `Card ${index + 1}`,
      format,
    })
  );
}

function cardsForId(id) {
  if (id === "standard") return standardPokerCards();
  if (id === "brass-two") return nCards(40, "B");
  return [catalogCard({ name: id })];
}

function nameForId(id) {
  return DISPLAY_NAMES[id] || `Official ${id}`;
}

function insertSeededCatalogFixtures(options = {}) {
  const owned = !options.catalog;
  const catalog = options.catalog ?? new DeckCatalog(options);
  try {
    for (const id of OFFICIAL_SEED_IDS) {
      if (catalog.hasId(id)) continue;
      catalog.insertTemplate({
        id,
        name: nameForId(id),
        cards: cardsForId(id),
        createdBy: "seed",
        enabled: 1,
      });
    }
    return catalog.count();
  } finally {
    if (owned) catalog.close();
  }
}

module.exports = {
  catalogCard,
  insertSeededCatalogFixtures,
  standardPokerCards,
};
