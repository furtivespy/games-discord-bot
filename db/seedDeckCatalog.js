const GameDB = require("./anygame.js");
const DeckCatalog = require("./deckCatalog.js");

const INSTANCE_ONLY_IDS = new Set(["custom-csv", "customempty"]);

function catalogCardFromGenerated(card) {
  return {
    name: card.name ?? "",
    description: card.description ?? "",
    type: card.type ?? "",
    suit: card.suit ?? "",
    value: card.value ?? "",
    url: card.url ?? null,
    format: card.format ?? "A",
  };
}

function seedDeckCatalog(options = {}) {
  const owned = !options.catalog;
  const catalog = options.catalog ?? new DeckCatalog(options);
  try {
    let inserted = 0;
    let skipped = 0;

    for (const [name, id] of GameDB.CurrentCardList) {
      if (INSTANCE_ONLY_IDS.has(id)) continue;

      if (catalog.hasId(id)) {
        skipped += 1;
        continue;
      }

      const generated = GameDB.MakeSpecificDeck("_seed_", id);
      if (!Array.isArray(generated) || generated.length === 0) continue;

      catalog.insertTemplate({
        id,
        name,
        cards: generated.map(catalogCardFromGenerated),
        createdBy: "seed",
        enabled: 1,
      });
      inserted += 1;
    }

    return {
      inserted,
      skipped,
      total: catalog.count(),
    };
  } finally {
    if (owned) catalog.close();
  }
}

module.exports = {
  seedDeckCatalog,
  catalogCardFromGenerated,
  INSTANCE_ONLY_IDS,
};
