const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const GameDB = require("../db/anygame.js");
const DeckCatalog = require("../db/deckCatalog.js");
const { seedDeckCatalog, INSTANCE_ONLY_IDS } = require("../db/seedDeckCatalog.js");
const pairCards = require("../db/decks/pairCards.js");
const Migrate = require("../slashcommands/util/migrate.js");

const RANDOM_SET_IDS = new Set(["shaolia-ws2", "shaolia-tw2", "shaolia-hf2"]);

function withTempDataDir(run) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-catalog-"));
  const previousDataDir = process.env.GAMEBOT_DATA_DIR;
  process.env.GAMEBOT_DATA_DIR = dataDir;
  const catalog = new DeckCatalog({ dataDir });
  try {
    return run({ dataDir, catalog });
  } finally {
    catalog.close();
    if (previousDataDir === undefined) {
      delete process.env.GAMEBOT_DATA_DIR;
    } else {
      process.env.GAMEBOT_DATA_DIR = previousDataDir;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

function expectedSeedIds() {
  return GameDB.CurrentCardList.filter(([, id]) => !INSTANCE_ONLY_IDS.has(id)).map(
    ([, id]) => id
  );
}

describe("seedDeckCatalog", () => {
  test("fresh db inserts every CurrentCardList id except instance-only sets", () => {
    withTempDataDir(({ catalog, dataDir }) => {
      const result = seedDeckCatalog({ catalog });
      const expectedIds = expectedSeedIds();

      expect(result.inserted).toBe(expectedIds.length);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(expectedIds.length);

      for (const id of expectedIds) {
        const template = catalog.getTemplate(id);
        expect(template).not.toBeNull();
        expect(template.enabled).toBe(1);
        expect(template.created_by).toBe("seed");
        expect(template.cards.length).toBeGreaterThan(0);
        for (const card of template.cards) {
          expect(card).not.toHaveProperty("id");
          expect(card).not.toHaveProperty("origin");
          expect(Object.keys(card).sort()).toEqual([
            "description",
            "format",
            "name",
            "suit",
            "type",
            "url",
            "value",
          ]);
        }
      }

      expect(catalog.getTemplate("custom-csv")).toBeNull();
      expect(catalog.getTemplate("customempty")).toBeNull();
      expect(fs.existsSync(path.join(dataDir, "game_documents.sqlite"))).toBe(
        false
      );
    });
  });

  test("non-random sets match a second MakeSpecificDeck call by count and names", () => {
    withTempDataDir(({ catalog }) => {
      seedDeckCatalog({ catalog });

      for (const [, id] of GameDB.CurrentCardList) {
        if (INSTANCE_ONLY_IDS.has(id) || RANDOM_SET_IDS.has(id)) continue;
        const stored = catalog.getTemplate(id);
        const generated = GameDB.MakeSpecificDeck("_compare_", id);
        expect(stored.cards.map((card) => card.name)).toEqual(
          generated.map((card) => card.name)
        );
      }
    });
  });

  test("shaolia random sets freeze one roll and match count only", () => {
    withTempDataDir(({ catalog }) => {
      seedDeckCatalog({ catalog });

      for (const id of RANDOM_SET_IDS) {
        const stored = catalog.getTemplate(id);
        const generated = GameDB.MakeSpecificDeck("_compare_", id);
        expect(stored.cards.length).toBe(generated.length);
        expect(stored.cards.length).toBeGreaterThan(0);
      }

      const firstJson = catalog.getTemplate("shaolia-ws2").cards;
      seedDeckCatalog({ catalog });
      expect(catalog.getTemplate("shaolia-ws2").cards).toEqual(firstJson);
    });
  });

  test("pear expands to the pair triangle after the arity fix", () => {
    withTempDataDir(({ catalog }) => {
      seedDeckCatalog({ catalog });
      const pear = catalog.getTemplate("pear");
      expect(pear.cards).toHaveLength(pairCards.length);
      expect(pear.cards.map((card) => card.name)).toEqual(pairCards);
    });
  });

  test("second seed inserts nothing and does not clobber mutated rows", () => {
    withTempDataDir(({ catalog }) => {
      const first = seedDeckCatalog({ catalog });
      const originalStandard = catalog.getTemplate("standard");

      catalog.db
        .query(`UPDATE deck_templates SET cards = ? WHERE id = ?`)
        .run("[]", "standard");

      const second = seedDeckCatalog({ catalog });

      expect(second.inserted).toBe(0);
      expect(second.skipped).toBe(first.inserted);
      expect(second.total).toBe(first.total);
      expect(catalog.getTemplate("standard").cards).toEqual([]);
      expect(catalog.getTemplate("standard").cards).not.toEqual(
        originalStandard.cards
      );
    });
  });

  test("unique id and name constraints hold", () => {
    withTempDataDir(({ catalog }) => {
      catalog.insertTemplate({
        id: "example",
        name: "Example Deck",
        cards: [{ name: "A", description: "", type: "", suit: "", value: "", url: null, format: "A" }],
      });

      expect(() =>
        catalog.insertTemplate({
          id: "example",
          name: "Different Name",
          cards: [],
        })
      ).toThrow();

      expect(() =>
        catalog.insertTemplate({
          id: "other",
          name: "Example Deck",
          cards: [],
        })
      ).toThrow();

      expect(catalog.hasId("example")).toBe(true);
      expect(catalog.hasName("Example Deck")).toBe(true);
      expect(catalog.hasId("missing")).toBe(false);
    });
  });

  test("does not write game_documents.sqlite even when that file already exists", () => {
    withTempDataDir(({ catalog, dataDir }) => {
      const gameDocsPath = path.join(dataDir, "game_documents.sqlite");
      fs.writeFileSync(gameDocsPath, "untouched");
      const before = fs.readFileSync(gameDocsPath);

      seedDeckCatalog({ catalog });

      expect(fs.readFileSync(gameDocsPath)).toEqual(before);
    });
  });
});

describe("/migrate job=deck-catalog", () => {
  test("reports inserted, skipped, and total rows", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-catalog-migrate-"));
    const previousDataDir = process.env.GAMEBOT_DATA_DIR;
    process.env.GAMEBOT_DATA_DIR = dataDir;

    const replies = [];
    const command = new Migrate({
      config: { botOwnerId: "owner" },
      logger: { log: () => {} },
    });
    const interaction = {
      user: { id: "owner" },
      deferReply: async () => {},
      editReply: async (response) => replies.push(response),
      options: {
        getString: (name) => (name === "job" ? "deck-catalog" : null),
      },
    };

    try {
      await command.execute(interaction);

      const expectedCount = expectedSeedIds().length;
      expect(replies[0].content).toContain(`Templates inserted: ${expectedCount}`);
      expect(replies[0].content).toContain(
        "Templates skipped (already present): 0"
      );
      expect(replies[0].content).toContain(`Total rows: ${expectedCount}`);
      expect(fs.existsSync(path.join(dataDir, "game_documents.sqlite"))).toBe(
        false
      );

      replies.length = 0;
      await command.execute(interaction);
      expect(replies[0].content).toContain("Templates inserted: 0");
      expect(replies[0].content).toContain(
        `Templates skipped (already present): ${expectedCount}`
      );
    } finally {
      if (previousDataDir === undefined) {
        delete process.env.GAMEBOT_DATA_DIR;
      } else {
        process.env.GAMEBOT_DATA_DIR = previousDataDir;
      }
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test("rejects overlapping migrate jobs", async () => {
    const replies = [];
    const command = new Migrate({
      config: { botOwnerId: "owner" },
      logger: { log: () => {} },
      _gameDocumentsMigrationRunning: true,
    });
    const interaction = {
      user: { id: "owner" },
      reply: async (response) => replies.push(response),
      options: { getString: () => "deck-catalog" },
    };

    await command.execute(interaction);
    expect(replies[0].content).toBe("A migration is already running.");
  });
});
