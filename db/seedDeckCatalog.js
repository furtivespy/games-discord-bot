const DeckCatalog = require("./deckCatalog.js");

const INSTANCE_ONLY_IDS = new Set(["custom-csv", "customempty", "empty"]);

// Reserved ids from the former JS catalog. Kept so /catalog publish cannot
// claim them. Card contents live only in sqlite; this set is not a seed source.
const OFFICIAL_SEED_IDS = new Set([
  "standard",
  "pear",
  "imperium",
  "dune-ix",
  "dune-immortality",
  "dune-ix-immortality",
  "dune-uprising",
  "dune-uprising-choam",
  "brian-boru",
  "cunning",
  "king-player",
  "not-alone-hunt",
  "not-alone-survival",
  "brass-two",
  "brass-three",
  "brass-four",
  "brass-wild-location",
  "brass-wild-industry",
  "blue-moon-city",
  "gome-explorer",
  "qe-industry",
  "qe-company-3",
  "qe-company-5",
  "tigris",
  "blood-rage-1",
  "blood-rage-2",
  "blood-rage-3",
  "money-1",
  "money-5",
  "money-10",
  "money-20",
  "heat-starting",
  "heat-upgrades",
  "heat-all",
  "empire-disaster",
  "el-grande",
  "riverboat-cultivation",
  "taj-mahal",
  "uno-classic",
  "penguin-party",
  "archipelago-short",
  "archipelago-medium",
  "archipelago-long",
  "love-letter",
  "love-letter-5plus",
  "spectral-glyphs",
  "spectral-letters",
  "rebirth",
  "candyland",
  "botswana",
  "molly-vice",
  "molly-loyalty",
  "molly-minor",
  "molly-major",
  "molly-item",
  "arcs-2-3",
  "arcs-4",
  "shaolia-level1",
  "shaolia-ws2",
  "shaolia-tw2",
  "shaolia-hf2",
  "shaolia-tcw2",
  "shaolia-tyrant2",
]);

function catalogCardFromGenerated(card) {
  const src = card != null && typeof card === "object" ? card : {};
  return {
    name: src.name ?? "",
    description: src.description ?? "",
    type: src.type ?? "",
    suit: src.suit ?? "",
    value: src.value ?? "",
    url: src.url ?? null,
    format: src.format ?? "A",
  };
}

function seedDeckCatalog(options = {}) {
  const owned = !options.catalog;
  const catalog = options.catalog ?? new DeckCatalog(options);
  try {
    // JS catalog is gone. Never insert templates from code. Existing rows
    // are left untouched (idempotent skip). A fresh empty db stays empty.
    const total = catalog.count();
    const nameIndex = catalog.ensureNameNocaseUniqueIndex();

    return {
      inserted: 0,
      skipped: total,
      total,
      nameIndex,
    };
  } finally {
    if (owned) catalog.close();
  }
}

module.exports = {
  seedDeckCatalog,
  catalogCardFromGenerated,
  INSTANCE_ONLY_IDS,
  OFFICIAL_SEED_IDS,
};
