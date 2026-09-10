const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const DeckCatalog = require("../db/deckCatalog.js");
const GameHelper = require("../modules/GlobalGameHelper");
const {
  CUSTOM_CSV_CARDSET,
  UNKNOWN_OR_DISABLED_CARD_SET,
  listCardSets,
  materializeDeck,
} = require("../db/catalogDecks.js");

const STORED_CARDS = [
  {
    id: "stored-ace",
    origin: "alpha-set",
    name: "Ace of Spades",
    description: "top",
    type: "pip",
    suit: "spades",
    value: "1",
    url: "https://example.test/ace.png",
    format: "B",
  },
  {
    name: "King",
    description: "",
    type: "",
    suit: "",
    value: "",
    url: null,
  },
];

function withTempDataDir(run) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-cutover-"));
  const previousDataDir = process.env.GAMEBOT_DATA_DIR;
  process.env.GAMEBOT_DATA_DIR = dataDir;
  try {
    return run({ dataDir });
  } finally {
    if (previousDataDir === undefined) {
      delete process.env.GAMEBOT_DATA_DIR;
    } else {
      process.env.GAMEBOT_DATA_DIR = previousDataDir;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

function seedCutoverCatalog(dataDir, { disabledId = "zeta-disabled" } = {}) {
  const catalog = new DeckCatalog({ dataDir });
  try {
    catalog.insertTemplate({
      id: "alpha-set",
      name: "Alpha Set",
      cards: STORED_CARDS,
      enabled: 1,
    });
    catalog.insertTemplate({
      id: disabledId,
      name: "Zeta Disabled",
      cards: [
        {
          name: "Hidden",
          description: "",
          type: "",
          suit: "",
          value: "",
          url: null,
          format: "A",
        },
      ],
      enabled: 0,
    });
    return catalog.listEnabledTemplateNames();
  } finally {
    catalog.close();
  }
}

function captureErrors(run) {
  const errors = [];
  const original = console.error;
  console.error = (...args) => {
    errors.push(args.map((arg) => String(arg)).join(" "));
  };
  try {
    return { result: run(), errors };
  } finally {
    console.error = original;
  }
}

describe("catalog deck cutover", () => {
  test("autocomplete source is enabled templates plus custom-csv; disabled id is absent", () => {
    withTempDataDir(({ dataDir }) => {
      seedCutoverCatalog(dataDir);

      const source = listCardSets({ dataDir });
      expect(source[0]).toEqual(CUSTOM_CSV_CARDSET);
      expect(source.map(([, id]) => id)).toEqual([
        "custom-csv",
        "alpha-set",
      ]);
      expect(source.some(([, id]) => id === "zeta-disabled")).toBe(false);

      const choices = GameHelper.getCardLists("", { dataDir });
      expect(choices).toEqual([
        { name: "Alpha Set", value: "alpha-set" },
        { name: "Custom - From CSV", value: "custom-csv" },
      ]);

      expect(GameHelper.getCardLists("alpha", { dataDir })).toEqual([
        { name: "Alpha Set", value: "alpha-set" },
      ]);
      const zeta = GameHelper.getCardLists("zeta", { dataDir });
      expect(zeta).toEqual([]);
    });
  });

  test("materialize matches stored JSON names; each card gets a new id and instance origin", () => {
    withTempDataDir(({ dataDir }) => {
      seedCutoverCatalog(dataDir);

      const result = materializeDeck("Table Deck", "alpha-set", { dataDir });
      expect(result.ok).toBe(true);
      expect(result.name).toBe("Alpha Set");
      expect(result.cards).toHaveLength(STORED_CARDS.length);
      expect(result.cards.map((card) => card.name)).toEqual(
        STORED_CARDS.map((card) => card.name)
      );
      expect(result.cards[0].format).toBe("B");
      expect(result.cards[1].format).toBe("A");
      expect(result.cards[0].id).not.toBe("stored-ace");
      expect(result.cards[1].id).toBeTruthy();
      expect(result.cards[0].id).not.toBe(result.cards[1].id);
      expect(result.cards.every((card) => card.origin === "Table Deck")).toBe(
        true
      );
      expect(result.cards.some((card) => card.origin === "alpha-set")).toBe(
        false
      );
    });
  });

  test("missing catalog db does not throw in the list helper and still offers custom-csv", () => {
    withTempDataDir(({ dataDir }) => {
      expect(fs.existsSync(path.join(dataDir, "deck_catalog.sqlite"))).toBe(
        false
      );

      const { result, errors } = captureErrors(() => listCardSets({ dataDir }));
      expect(result).toEqual([CUSTOM_CSV_CARDSET]);
      expect(errors.some((line) => line.includes("missing"))).toBe(true);
      expect(errors.some((line) => line.includes("custom-csv"))).toBe(true);

      const { result: choices } = captureErrors(() =>
        GameHelper.getCardLists("custom", { dataDir })
      );
      expect(choices).toEqual([
        { name: "Custom - From CSV", value: "custom-csv" },
      ]);
    });
  });

  test("disabled template cannot be instantiated", () => {
    withTempDataDir(({ dataDir }) => {
      seedCutoverCatalog(dataDir);

      const result = materializeDeck("Table Deck", "zeta-disabled", {
        dataDir,
      });
      expect(result.ok).toBe(false);
      expect(result.cards).toEqual([]);
      expect(result.error).toBe(UNKNOWN_OR_DISABLED_CARD_SET);
    });
  });
});
