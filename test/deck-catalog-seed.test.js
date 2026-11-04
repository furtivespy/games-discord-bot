const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const DeckCatalog = require("../db/deckCatalog.js");
const { seedDeckCatalog } = require("../db/seedDeckCatalog.js");
const { insertSeededCatalogFixtures } = require("./helpers/catalogFixtures");
const Migrate = require("../slashcommands/util/migrate.js");

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

describe("seedDeckCatalog", () => {
  test("anygame and seed do not read a JS card list", () => {
    const anygame = fs.readFileSync(path.join(__dirname, "../db/anygame.js"), "utf8");
    const seed = fs.readFileSync(
      path.join(__dirname, "../db/seedDeckCatalog.js"),
      "utf8"
    );
    expect(anygame).not.toMatch(/CurrentCardList|MakeSpecificDeck|db\/decks/);
    expect(seed).not.toMatch(/CurrentCardList|MakeSpecificDeck/);
    expect(fs.existsSync(path.join(__dirname, "../db/decks"))).toBe(false);
  });

  test("fresh empty db inserts nothing from JS", () => {
    withTempDataDir(({ catalog, dataDir }) => {
      const result = seedDeckCatalog({ catalog });

      expect(result.inserted).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(0);
      expect(catalog.count()).toBe(0);
      expect(catalog.getTemplate("standard")).toBeNull();
      expect(catalog.getTemplate("custom-csv")).toBeNull();
      expect(catalog.getTemplate("empty")).toBeNull();
      expect(fs.existsSync(path.join(dataDir, "game_documents.sqlite"))).toBe(
        false
      );
    });
  });

  test("seed on a db that already has rows skips and does not clobber mutated rows", () => {
    withTempDataDir(({ catalog }) => {
      insertSeededCatalogFixtures({ catalog });
      const originalStandard = catalog.getTemplate("standard");
      expect(originalStandard).not.toBeNull();
      const existingCount = catalog.count();

      catalog.db
        .query(`UPDATE deck_templates SET cards = ? WHERE id = ?`)
        .run("[]", "standard");

      const second = seedDeckCatalog({ catalog });

      expect(second.inserted).toBe(0);
      expect(second.skipped).toBe(existingCount);
      expect(second.total).toBe(existingCount);
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

  test("fresh seed creates the NOCASE name index", () => {
    withTempDataDir(({ catalog }) => {
      const result = seedDeckCatalog({ catalog });
      expect(result.nameIndex.status).toBe("created");
      expect(
        catalog.db
          .query(
            `SELECT 1 AS ok FROM sqlite_master WHERE type = 'index' AND name = 'idx_deck_templates_name_nocase'`
          )
          .get()
      ).toBeTruthy();
    });
  });

  test("seed with NOCASE collisions skips the index and keeps every existing row", () => {
    withTempDataDir(({ catalog }) => {
      catalog.insertTemplate({
        id: "foo-upper",
        name: "Foo",
        cards: [{ name: "A", description: "", type: "", suit: "", value: "", url: null, format: "A" }],
      });
      catalog.insertTemplate({
        id: "foo-lower",
        name: "foo",
        cards: [{ name: "B", description: "", type: "", suit: "", value: "", url: null, format: "A" }],
      });

      const result = seedDeckCatalog({ catalog });
      expect(result.nameIndex.status).toBe("skipped");
      expect(result.inserted).toBe(0);
      expect(result.skipped).toBe(2);
      expect(result.total).toBe(2);
      expect(catalog.getTemplate("foo-upper").name).toBe("Foo");
      expect(catalog.getTemplate("foo-lower").name).toBe("foo");
      expect(catalog.getTemplate("standard")).toBeNull();
      expect(
        catalog.db
          .query(
            `SELECT 1 AS ok FROM sqlite_master WHERE type = 'index' AND name = 'idx_deck_templates_name_nocase'`
          )
          .get()
      ).toBeFalsy();

      const again = seedDeckCatalog({ catalog });
      expect(again.nameIndex.status).toBe("skipped");
      expect(again.inserted).toBe(0);
      expect(again.skipped).toBe(2);
      expect(catalog.getTemplate("foo-upper").name).toBe("Foo");
      expect(catalog.getTemplate("foo-lower").name).toBe("foo");
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

describe("/migrate", () => {
  test("reports inserted, skipped, and total rows without recreating sets from code", async () => {
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
      options: {},
    };

    try {
      await command.execute(interaction);

      expect(replies[0].content).toContain("Deck catalog check complete.");
      expect(replies[0].content).toContain(
        "This command does not insert card sets from code."
      );
      expect(replies[0].content).toContain("Templates inserted: 0");
      expect(replies[0].content).toContain(
        "Templates skipped (already present): 0"
      );
      expect(replies[0].content).toContain("Total rows: 0");
      expect(replies[0].content).toMatch(/restore a seeded catalog/i);
      expect(replies[0].content).not.toContain("Deck catalog seed complete.");
      expect(fs.existsSync(path.join(dataDir, "game_documents.sqlite"))).toBe(
        false
      );

      const catalog = new DeckCatalog({ dataDir });
      try {
        insertSeededCatalogFixtures({ catalog });
        const existingCount = catalog.count();
        expect(existingCount).toBeGreaterThan(0);
        catalog.db
          .query(`UPDATE deck_templates SET cards = ? WHERE id = ?`)
          .run("[]", "standard");
      } finally {
        catalog.close();
      }

      replies.length = 0;
      await command.execute(interaction);
      expect(replies[0].content).toContain("Deck catalog check complete.");
      expect(replies[0].content).toContain("Templates inserted: 0");
      expect(replies[0].content).toMatch(
        /Templates skipped \(already present\): \d+/
      );
      expect(replies[0].content).not.toContain("Templates skipped (already present): 0");
      expect(replies[0].content).not.toMatch(/restore a seeded catalog/i);

      const after = new DeckCatalog({ dataDir });
      try {
        expect(after.getTemplate("standard").cards).toEqual([]);
      } finally {
        after.close();
      }
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
      _deckCatalogMigrationRunning: true,
    });
    const interaction = {
      user: { id: "owner" },
      reply: async (response) => replies.push(response),
      options: {},
    };

    await command.execute(interaction);
    expect(replies[0].content).toBe("A migration is already running.");
  });

  test("reports skipped NOCASE index when case-variant names already exist", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-catalog-migrate-"));
    const previousDataDir = process.env.GAMEBOT_DATA_DIR;
    process.env.GAMEBOT_DATA_DIR = dataDir;

    const catalog = new DeckCatalog({ dataDir });
    catalog.insertTemplate({
      id: "foo-upper",
      name: "Foo",
      cards: [{ name: "A", description: "", type: "", suit: "", value: "", url: null, format: "A" }],
    });
    catalog.insertTemplate({
      id: "foo-lower",
      name: "foo",
      cards: [{ name: "B", description: "", type: "", suit: "", value: "", url: null, format: "A" }],
    });
    catalog.close();

    const replies = [];
    const command = new Migrate({
      config: { botOwnerId: "owner" },
      logger: { log: () => {} },
    });
    const interaction = {
      user: { id: "owner" },
      deferReply: async () => {},
      editReply: async (response) => replies.push(response),
      options: {},
    };

    try {
      await command.execute(interaction);
      expect(replies[0].content).toMatch(/all rows kept/i);
      expect(replies[0].content).toMatch(/Foo|foo/);
      expect(replies[0].content).toContain("Templates inserted: 0");

      const after = new DeckCatalog({ dataDir });
      try {
        expect(after.getTemplate("foo-upper").name).toBe("Foo");
        expect(after.getTemplate("foo-lower").name).toBe("foo");
        expect(after.getTemplate("standard")).toBeNull();
        expect(
          after.db
            .query(
              `SELECT 1 AS ok FROM sqlite_master WHERE type = 'index' AND name = 'idx_deck_templates_name_nocase'`
            )
            .get()
        ).toBeFalsy();
      } finally {
        after.close();
      }
    } finally {
      if (previousDataDir === undefined) {
        delete process.env.GAMEBOT_DATA_DIR;
      } else {
        process.env.GAMEBOT_DATA_DIR = previousDataDir;
      }
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
