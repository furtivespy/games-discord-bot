const {
  catalogCardFromGenerated,
  INSTANCE_ONLY_IDS,
} = require("./seedDeckCatalog.js");

const CATALOG_ID_PATTERN = /^[a-z0-9-]{1,100}$/;

function validateCatalogId(id) {
  if (typeof id !== "string" || !CATALOG_ID_PATTERN.test(id)) {
    return {
      ok: false,
      code: "invalid_id",
      error:
        "Catalog id must match ^[a-z0-9-]{1,100}$ (lowercase letters, digits, and hyphens only).",
    };
  }
  if (INSTANCE_ONLY_IDS.has(id)) {
    return {
      ok: false,
      code: "reserved_id",
      error: `Cannot publish as "${id}"; that id is reserved for in-channel custom decks.`,
    };
  }
  return { ok: true, id };
}

function buildPublishCards(allCards) {
  if (!Array.isArray(allCards) || allCards.length === 0) {
    return {
      ok: false,
      code: "empty_cards",
      error: "This deck has no cards in allCards to publish.",
    };
  }
  return {
    ok: true,
    cards: allCards.map(catalogCardFromGenerated),
  };
}

function buildPublishPayload({ id, name, allCards, createdBy }) {
  const idCheck = validateCatalogId(id);
  if (!idCheck.ok) return idCheck;

  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName) {
    return {
      ok: false,
      code: "invalid_name",
      error: "Display name is required.",
    };
  }

  const cardsCheck = buildPublishCards(allCards);
  if (!cardsCheck.ok) return cardsCheck;

  return {
    ok: true,
    payload: {
      id,
      name: trimmedName,
      cards: cardsCheck.cards,
      createdBy: createdBy == null ? "" : String(createdBy),
      enabled: 1,
    },
  };
}

function assertUnique(catalog, { id, name }) {
  if (catalog.hasId(id)) {
    return {
      ok: false,
      code: "duplicate_id",
      error: `A catalog template with id "${id}" already exists. Publish always saves as a new id and will not overwrite.`,
    };
  }
  if (catalog.hasName(name)) {
    return {
      ok: false,
      code: "duplicate_name",
      error: `A catalog template named "${name}" already exists. Choose a unique display name.`,
    };
  }
  return { ok: true };
}

function publishToCatalog(catalog, input) {
  const built = buildPublishPayload(input);
  if (!built.ok) return built;

  const unique = assertUnique(catalog, built.payload);
  if (!unique.ok) return unique;

  catalog.insertTemplate({
    id: built.payload.id,
    name: built.payload.name,
    cards: built.payload.cards,
    createdBy: built.payload.createdBy,
    enabled: 1,
  });

  return {
    ok: true,
    template: catalog.getTemplate(built.payload.id),
  };
}

module.exports = {
  CATALOG_ID_PATTERN,
  validateCatalogId,
  buildPublishCards,
  buildPublishPayload,
  assertUnique,
  publishToCatalog,
};
