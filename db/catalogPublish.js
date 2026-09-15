const {
  catalogCardFromGenerated,
  INSTANCE_ONLY_IDS,
  OFFICIAL_SEED_IDS,
} = require("./seedDeckCatalog.js");
const {
  canonicalDisplayName,
  sqliteUniqueField,
} = require("./deckCatalog.js");

const CATALOG_ID_PATTERN = /^[a-z0-9-]{1,100}$/;

const EMPTY_CARDS_ERROR =
  "This deck has no cards to publish. allCards is empty, and there are no cards in the draw pile, discard pile, or player hands.";

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
  if (OFFICIAL_SEED_IDS.has(id)) {
    return {
      ok: false,
      code: "reserved_id",
      error: `Cannot publish as "${id}"; that id is reserved for the official catalog seed. Run \`/migrate\` with job \`deck-catalog\` if it is missing.`,
    };
  }
  return { ok: true, id };
}

function isPublishableCard(card) {
  return card != null && typeof card === "object" && !Array.isArray(card);
}

function cardsFromPile(pile) {
  if (Array.isArray(pile)) return pile;
  if (pile && Array.isArray(pile.cards)) return pile.cards;
  return [];
}

function cardBelongsToDeck(card, deckName) {
  if (!card || typeof card !== "object") return false;
  const origin = card.origin;
  if (origin == null || origin === "") return true;
  return String(origin).toLowerCase() === String(deckName ?? "").toLowerCase();
}

function cardsFromHands(players, deckName) {
  const cards = [];
  for (const player of players || []) {
    const hands = player?.hands;
    if (!hands || typeof hands !== "object") continue;
    for (const location of Object.values(hands)) {
      for (const card of cardsFromPile(location)) {
        if (cardBelongsToDeck(card, deckName)) {
          cards.push(card);
        }
      }
    }
  }
  return cards;
}

function collectLiveDeckCards(deck, players) {
  const cards = [];
  const seen = new Set();
  const add = (list) => {
    for (const card of list) {
      if (isPublishableCard(card) && card.id) {
        if (seen.has(card.id)) continue;
        seen.add(card.id);
      }
      cards.push(card);
    }
  };
  add(cardsFromPile(deck?.piles?.draw));
  add(cardsFromPile(deck?.piles?.discard));
  add(cardsFromHands(players, deck?.name));
  return cards;
}

function buildPublishCards(allCards) {
  if (allCards == null || !Array.isArray(allCards) || allCards.length === 0) {
    return {
      ok: false,
      code: "empty_cards",
      error: EMPTY_CARDS_ERROR,
    };
  }
  const cards = [];
  for (const card of allCards) {
    if (!isPublishableCard(card)) {
      return {
        ok: false,
        code: "invalid_cards",
        error:
          "This deck has invalid card data (null or non-object entries) and cannot be published.",
      };
    }
    cards.push(catalogCardFromGenerated(card));
  }
  return { ok: true, cards };
}

function resolvePublishCards({ allCards, deck, players }) {
  if (Array.isArray(allCards) && allCards.length > 0) {
    return buildPublishCards(allCards);
  }
  const live = collectLiveDeckCards(deck, players);
  if (live.length > 0) {
    return buildPublishCards(live);
  }
  return {
    ok: false,
    code: "empty_cards",
    error: EMPTY_CARDS_ERROR,
  };
}

function buildPublishPayload({ id, name, allCards, deck, players, createdBy }) {
  const idCheck = validateCatalogId(id);
  if (!idCheck.ok) return idCheck;

  const trimmedName = canonicalDisplayName(name);
  if (!trimmedName) {
    return {
      ok: false,
      code: "invalid_name",
      error: "Display name is required.",
    };
  }

  const cardsCheck = resolvePublishCards({ allCards, deck, players });
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

function duplicateResult(field, { id, name }) {
  if (field === "name") {
    return {
      ok: false,
      code: "duplicate_name",
      error: `A catalog template named "${name}" already exists. Choose a unique display name.`,
    };
  }
  return {
    ok: false,
    code: "duplicate_id",
    error: `A catalog template with id "${id}" already exists. Publish always saves as a new id and will not overwrite.`,
  };
}

function publishToCatalog(catalog, input) {
  const built = buildPublishPayload(input);
  if (!built.ok) return built;

  const run = () => {
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
  };

  try {
    if (typeof catalog.transaction === "function") {
      return catalog.transaction(run);
    }
    return run();
  } catch (error) {
    const field = sqliteUniqueField(error);
    if (field) {
      return duplicateResult(field, built.payload);
    }
    throw error;
  }
}

module.exports = {
  CATALOG_ID_PATTERN,
  EMPTY_CARDS_ERROR,
  validateCatalogId,
  collectLiveDeckCards,
  buildPublishCards,
  buildPublishPayload,
  assertUnique,
  publishToCatalog,
};
