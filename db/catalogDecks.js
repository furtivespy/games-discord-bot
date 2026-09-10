const GameDB = require("./anygame.js");
const DeckCatalog = require("./deckCatalog.js");
const { INSTANCE_ONLY_IDS } = require("./seedDeckCatalog.js");

const CUSTOM_CSV_CARDSET = ["Custom - From CSV", "custom-csv"];
const UNKNOWN_OR_DISABLED_CARD_SET = "unknown or disabled card set";

function logCatalogUnavailable(info, reason) {
  console.error(
    `Deck catalog ${reason} at ${info.dbPath}; /cards deck new will only offer custom-csv. Run /migrate with job deck-catalog first.`
  );
}

function withCatalog(options, fn) {
  const info = DeckCatalog.inspect(options);
  if (!info.exists || !info.hasSchema) {
    logCatalogUnavailable(info, "is missing or has an empty schema");
    return fn(null, info);
  }

  let catalog;
  try {
    catalog = new DeckCatalog(options);
  } catch (err) {
    console.error(`Failed to open deck catalog at ${info.dbPath}:`, err);
    return fn(null, info);
  }

  try {
    if (catalog.count() === 0) {
      logCatalogUnavailable(info, "has zero templates");
    }
    return fn(catalog, info);
  } finally {
    catalog.close();
  }
}

function listCardSets(options = {}) {
  const entries = [CUSTOM_CSV_CARDSET];
  try {
    withCatalog(options, (catalog) => {
      if (!catalog) return;
      for (const row of catalog.listEnabledTemplateNames()) {
        if (INSTANCE_ONLY_IDS.has(row.id)) continue;
        entries.push([row.name, row.id]);
      }
    });
  } catch (err) {
    console.error("Failed to list deck catalog templates:", err);
  }
  return entries;
}

function cardsFromTemplate(instanceDeckName, template) {
  return (template.cards || []).map((card) =>
    GameDB.createCardFromObj(instanceDeckName, card.format || "A", card)
  );
}

function readEnabledTemplate(id, options = {}) {
  try {
    return withCatalog(options, (catalog) => {
      if (!catalog) return null;
      const template = catalog.getTemplate(id);
      if (!template || Number(template.enabled) !== 1) return null;
      if (!Array.isArray(template.cards)) return null;
      return template;
    });
  } catch (err) {
    console.error(`Failed to read deck catalog template "${id}":`, err);
    return null;
  }
}

function materializeDeck(instanceDeckName, templateId, options = {}) {
  const template = readEnabledTemplate(templateId, options);
  if (!template) {
    return {
      ok: false,
      cards: [],
      error: UNKNOWN_OR_DISABLED_CARD_SET,
    };
  }
  return {
    ok: true,
    name: template.name,
    cards: cardsFromTemplate(instanceDeckName, template),
  };
}

module.exports = {
  CUSTOM_CSV_CARDSET,
  UNKNOWN_OR_DISABLED_CARD_SET,
  listCardSets,
  readEnabledTemplate,
  cardsFromTemplate,
  materializeDeck,
};
