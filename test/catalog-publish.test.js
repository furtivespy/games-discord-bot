const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const DeckCatalog = require("../db/deckCatalog.js");
const {
  classifySqliteOpenError,
  formatNameNocaseIndexSkip,
  isCatalogEnabled,
  isEnabled,
  NAME_NOCASE_INDEX,
  normalizeDisplayName,
  normalizeEnabled,
  parseTemplateRow,
  sqliteUniqueField,
} = DeckCatalog;
const { seedDeckCatalog, OFFICIAL_SEED_IDS } = require("../db/seedDeckCatalog.js");
const {
  EMPTY_CARDS_ERROR,
  buildPublishPayload,
  publishToCatalog,
  validateCatalogId,
} = require("../db/catalogPublish.js");
const { Database } = require("bun:sqlite");

function withTempCatalog(run) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-publish-"));
  const catalog = new DeckCatalog({ dataDir });
  try {
    return run({ dataDir, catalog });
  } finally {
    catalog.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

function runtimeCard(overrides = {}) {
  return {
    id: "runtime-1",
    origin: "Main",
    extra: "drop-me",
    name: "Ace",
    description: "top card",
    type: "pip",
    suit: "spades",
    value: "1",
    url: "https://example.test/ace.png",
    format: "A",
    ...overrides,
  };
}

describe("catalog publish payload builder", () => {
  test("strips runtime id/origin and unknown fields", () => {
    const result = buildPublishPayload({
      id: "my-custom",
      name: " My Custom ",
      createdBy: "owner-1",
      allCards: [runtimeCard(), runtimeCard({ id: "runtime-2", name: "King" })],
    });

    expect(result.ok).toBe(true);
    expect(result.payload.enabled).toBe(1);
    expect(result.payload.createdBy).toBe("owner-1");
    expect(result.payload.name).toBe("My Custom");
    expect(result.payload.cards).toHaveLength(2);
    for (const card of result.payload.cards) {
      expect(card).not.toHaveProperty("id");
      expect(card).not.toHaveProperty("origin");
      expect(card).not.toHaveProperty("extra");
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
    expect(result.payload.cards[0]).toEqual({
      name: "Ace",
      description: "top card",
      type: "pip",
      suit: "spades",
      value: "1",
      url: "https://example.test/ace.png",
      format: "A",
    });
  });

  test("rejects invalid slugs, instance-only ids, and official seed ids", () => {
    expect(validateCatalogId("Standard").ok).toBe(false);
    expect(validateCatalogId("has_underscore").error).toContain("^[a-z0-9-]{1,100}$");
    expect(validateCatalogId("custom-csv").code).toBe("reserved_id");
    expect(validateCatalogId("customempty").code).toBe("reserved_id");
    expect(validateCatalogId("empty").code).toBe("reserved_id");
    expect(validateCatalogId("standard").code).toBe("reserved_id");
    expect(validateCatalogId("standard").error).toMatch(/official catalog seed/i);
    expect(OFFICIAL_SEED_IDS.has("standard")).toBe(true);
    expect(OFFICIAL_SEED_IDS.has("uno-classic")).toBe(true);
    expect(OFFICIAL_SEED_IDS.has("custom-csv")).toBe(false);
    expect(
      buildPublishPayload({
        id: "ok-id",
        name: "Ok",
        allCards: [],
        createdBy: "1",
      }).code
    ).toBe("empty_cards");
    expect(
      buildPublishPayload({
        id: "ok-id",
        name: "Ok",
        allCards: [],
        createdBy: "1",
      }).error
    ).toBe(EMPTY_CARDS_ERROR);
    expect(
      buildPublishPayload({
        id: "ok-id",
        name: "Ok",
        allCards: null,
        createdBy: "1",
      }).code
    ).toBe("empty_cards");
    expect(
      buildPublishPayload({
        id: "ok-id",
        name: "Ok",
        allCards: { name: "not-an-array" },
        createdBy: "1",
      }).code
    ).toBe("empty_cards");
    const hostile = buildPublishPayload({
      id: "ok-id",
      name: "Ok",
      allCards: [null],
      createdBy: "1",
    });
    expect(hostile.ok).toBe(false);
    expect(hostile.code).toBe("invalid_cards");
    expect(hostile.error).toMatch(/invalid card data/i);
  });

  test("empty allCards publishes cards from draw, discard, and hands with empty or case-mismatched origin", () => {
    const draw = runtimeCard({ id: "d1", name: "Draw" });
    const discard = runtimeCard({ id: "d2", name: "Discard" });
    const hand = runtimeCard({ id: "h1", name: "Hand" });
    const emptyOrigin = runtimeCard({
      id: "h2",
      name: "No Origin",
      origin: "",
    });
    const missingOrigin = runtimeCard({ id: "h3", name: "Missing Origin" });
    delete missingOrigin.origin;
    const caseMismatch = runtimeCard({
      id: "h4",
      name: "Case Origin",
      origin: "main",
    });
    const otherDeck = runtimeCard({
      id: "o1",
      name: "Other",
      origin: "OtherDeck",
    });
    const result = buildPublishPayload({
      id: "from-live",
      name: "From Live",
      createdBy: "1",
      allCards: [],
      deck: {
        name: "Main",
        piles: {
          draw: { cards: [draw] },
          discard: { cards: [discard] },
        },
      },
      players: [
        { hands: { main: [hand, emptyOrigin, missingOrigin, caseMismatch, otherDeck] } },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.payload.cards.map((card) => card.name).sort()).toEqual([
      "Case Origin",
      "Discard",
      "Draw",
      "Hand",
      "Missing Origin",
      "No Origin",
    ]);
  });

  test("empty allCards with no live cards explains draw, discard, and hands", () => {
    const result = buildPublishPayload({
      id: "ok-id",
      name: "Ok",
      createdBy: "1",
      allCards: [],
      deck: {
        name: "Main",
        piles: { draw: { cards: [] }, discard: { cards: [] } },
      },
      players: [{ hands: { main: [] } }],
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("empty_cards");
    expect(result.error).toMatch(/draw pile/i);
    expect(result.error).toMatch(/discard pile/i);
    expect(result.error).toMatch(/player hands/i);
  });

  test("publish inserts a row; same id or display name refuses without overwrite", () => {
    withTempCatalog(({ catalog }) => {
      const first = publishToCatalog(catalog, {
        id: "my-custom",
        name: "My Custom",
        createdBy: "owner-1",
        allCards: [runtimeCard()],
      });
      expect(first.ok).toBe(true);
      expect(first.template.enabled).toBe(1);
      expect(first.template.created_by).toBe("owner-1");
      expect(first.template.cards[0]).not.toHaveProperty("id");
      expect(first.template.cards[0]).not.toHaveProperty("origin");

      const sameId = publishToCatalog(catalog, {
        id: "my-custom",
        name: "A Different Name",
        createdBy: "owner-1",
        allCards: [runtimeCard({ name: "Queen" })],
      });
      expect(sameId.ok).toBe(false);
      expect(sameId.code).toBe("duplicate_id");
      expect(catalog.getTemplate("my-custom").cards[0].name).toBe("Ace");

      const sameName = publishToCatalog(catalog, {
        id: "other-id",
        name: "My Custom",
        createdBy: "owner-1",
        allCards: [runtimeCard({ name: "Queen" })],
      });
      expect(sameName.ok).toBe(false);
      expect(sameName.code).toBe("duplicate_name");
      expect(catalog.hasId("other-id")).toBe(false);
      expect(catalog.count()).toBe(1);
    });
  });

  test("display names are unique after case and whitespace folding", () => {
    withTempCatalog(({ catalog }) => {
      const first = publishToCatalog(catalog, {
        id: "uno-copy",
        name: "  Uno   Classic ",
        createdBy: "owner-1",
        allCards: [runtimeCard()],
      });
      expect(first.ok).toBe(true);
      expect(first.template.name).toBe("Uno Classic");
      expect(normalizeDisplayName("Uno Classic")).toBe("uno classic");

      const sameCase = publishToCatalog(catalog, {
        id: "uno-copy-2",
        name: "uno classic",
        createdBy: "owner-1",
        allCards: [runtimeCard({ name: "Queen" })],
      });
      expect(sameCase.ok).toBe(false);
      expect(sameCase.code).toBe("duplicate_name");
      expect(catalog.hasName("UNO CLASSIC")).toBe(true);
      expect(catalog.hasId("uno-copy-2")).toBe(false);

      const sameSpaces = publishToCatalog(catalog, {
        id: "uno-copy-3",
        name: "Uno  Classic",
        createdBy: "owner-1",
        allCards: [runtimeCard({ name: "Queen" })],
      });
      expect(sameSpaces.ok).toBe(false);
      expect(sameSpaces.code).toBe("duplicate_name");
      expect(catalog.count()).toBe(1);
    });
  });

  test("disable then enable flips the flag only", () => {
    withTempCatalog(({ catalog }) => {
      publishToCatalog(catalog, {
        id: "flip-me",
        name: "Flip Me",
        createdBy: "owner-1",
        allCards: [runtimeCard(), runtimeCard({ name: "King" })],
      });
      const before = catalog.getTemplate("flip-me");

      catalog.setEnabled("flip-me", 0);
      const disabled = catalog.getTemplate("flip-me");
      expect(disabled.enabled).toBe(0);
      expect(disabled.cards).toEqual(before.cards);
      expect(disabled.name).toBe(before.name);
      expect(disabled.created_by).toBe(before.created_by);

      catalog.setEnabled("flip-me", 1);
      const enabled = catalog.getTemplate("flip-me");
      expect(enabled.enabled).toBe(1);
      expect(enabled.cards).toEqual(before.cards);
      expect(enabled.name).toBe(before.name);
    });
  });

  test("seed rows are not updated by publish; official seed ids cannot be claimed before seed", () => {
    withTempCatalog(({ catalog }) => {
      expect(catalog.count()).toBe(0);
      const beforeSeed = publishToCatalog(catalog, {
        id: "standard",
        name: "Hijack Standard",
        createdBy: "owner-1",
        allCards: [runtimeCard()],
      });
      expect(beforeSeed.ok).toBe(false);
      expect(beforeSeed.code).toBe("reserved_id");
      expect(beforeSeed.error).toMatch(/deck-catalog/);
      expect(catalog.hasId("standard")).toBe(false);
      expect(catalog.count()).toBe(0);

      seedDeckCatalog({ catalog });
      const seededStandard = catalog.getTemplate("standard");
      expect(seededStandard).not.toBeNull();
      const seedCount = catalog.count();

      const overwriteSeed = publishToCatalog(catalog, {
        id: "standard",
        name: "Should Not Replace Standard",
        createdBy: "owner-1",
        allCards: [runtimeCard()],
      });
      expect(overwriteSeed.ok).toBe(false);
      expect(overwriteSeed.code).toBe("reserved_id");
      expect(catalog.getTemplate("standard")).toEqual(seededStandard);

      const sameSeedName = publishToCatalog(catalog, {
        id: "brand-new",
        name: seededStandard.name,
        createdBy: "owner-1",
        allCards: [runtimeCard()],
      });
      expect(sameSeedName.ok).toBe(false);
      expect(sameSeedName.code).toBe("duplicate_name");
      expect(catalog.hasId("brand-new")).toBe(false);
      expect(catalog.getTemplate("standard")).toEqual(seededStandard);

      const inserted = publishToCatalog(catalog, {
        id: "brand-new",
        name: "Brand New Published",
        createdBy: "owner-1",
        allCards: [runtimeCard()],
      });
      expect(inserted.ok).toBe(true);
      expect(catalog.count()).toBe(seedCount + 1);
      expect(catalog.getTemplate("standard")).toEqual(seededStandard);
    });
  });

  test("UNIQUE constraint on insert maps to duplicate_id or duplicate_name", () => {
    withTempCatalog(({ catalog }) => {
      expect(catalog.ensureNameNocaseUniqueIndex().status).toBe("created");
      const first = publishToCatalog(catalog, {
        id: "my-custom",
        name: "My Custom",
        createdBy: "owner-1",
        allCards: [runtimeCard()],
      });
      expect(first.ok).toBe(true);

      catalog.hasId = () => false;
      catalog.hasName = () => false;

      const sameId = publishToCatalog(catalog, {
        id: "my-custom",
        name: "A Different Name",
        createdBy: "owner-1",
        allCards: [runtimeCard({ name: "Queen" })],
      });
      expect(sameId.ok).toBe(false);
      expect(sameId.code).toBe("duplicate_id");
      expect(catalog.getTemplate("my-custom").cards[0].name).toBe("Ace");

      const sameName = publishToCatalog(catalog, {
        id: "other-id",
        name: "My Custom",
        createdBy: "owner-1",
        allCards: [runtimeCard({ name: "Queen" })],
      });
      expect(sameName.ok).toBe(false);
      expect(sameName.code).toBe("duplicate_name");
      expect(catalog.getTemplate("other-id")).toBeNull();
      expect(catalog.count()).toBe(1);

      catalog.hasId = () => false;
      catalog.hasName = () => false;
      const sameCase = publishToCatalog(catalog, {
        id: "case-id",
        name: "my custom",
        createdBy: "owner-1",
        allCards: [runtimeCard({ name: "Queen" })],
      });
      expect(sameCase.ok).toBe(false);
      expect(sameCase.code).toBe("duplicate_name");
      expect(catalog.getTemplate("case-id")).toBeNull();
    });
  });
});

describe("DeckCatalog.inspect", () => {
  test("does not create a catalog file and reports missing db", () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-inspect-"));
    try {
      const info = DeckCatalog.inspect({ dataDir });
      expect(info.exists).toBe(false);
      expect(info.hasSchema).toBe(false);
      expect(info.error).toBeNull();
      expect(fs.existsSync(info.dbPath)).toBe(false);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test("valid sqlite without deck_templates is missing schema, not corrupt", () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-inspect-"));
    try {
      const dbPath = path.join(dataDir, "deck_catalog.sqlite");
      const db = new Database(dbPath);
      db.exec("CREATE TABLE other (id TEXT)");
      db.close();

      const info = DeckCatalog.inspect({ dataDir });
      expect(info.exists).toBe(true);
      expect(info.hasSchema).toBe(false);
      expect(info.error).toBeNull();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test("garbage and malformed files are corrupt, not missing schema", () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-inspect-"));
    try {
      const garbagePath = path.join(dataDir, "garbage.sqlite");
      fs.writeFileSync(garbagePath, "this is not a sqlite database\n");
      const garbage = DeckCatalog.inspect({ dbPath: garbagePath });
      expect(garbage.exists).toBe(true);
      expect(garbage.hasSchema).toBe(false);
      expect(garbage.error).toBe("corrupt");

      const truncPath = path.join(dataDir, "trunc.sqlite");
      const db = new Database(truncPath);
      db.exec("CREATE TABLE t (id TEXT); INSERT INTO t VALUES ('x')");
      db.close();
      const buf = fs.readFileSync(truncPath);
      fs.writeFileSync(truncPath, buf.subarray(0, 40));
      const truncated = DeckCatalog.inspect({ dbPath: truncPath });
      expect(truncated.error).toBe("corrupt");
      expect(truncated.hasSchema).toBe(false);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test("locked database is reported as locked, not missing schema", () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-inspect-"));
    const dbPath = path.join(dataDir, "deck_catalog.sqlite");
    const db = new Database(dbPath);
    try {
      db.exec("PRAGMA journal_mode = DELETE");
      db.exec("CREATE TABLE deck_templates (id TEXT PRIMARY KEY)");
      db.exec("BEGIN EXCLUSIVE");
      const info = DeckCatalog.inspect({ dbPath });
      expect(info.exists).toBe(true);
      expect(info.hasSchema).toBe(false);
      expect(info.error).toBe("locked");
    } finally {
      try {
        db.exec("ROLLBACK");
      } catch (_) {}
      db.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test("classifySqliteOpenError maps sqlite codes", () => {
    expect(
      classifySqliteOpenError({ code: "SQLITE_BUSY", message: "database is locked" })
    ).toBe("locked");
    expect(
      classifySqliteOpenError({
        code: "SQLITE_NOTADB",
        message: "file is not a database",
      })
    ).toBe("corrupt");
    expect(
      classifySqliteOpenError({
        code: "SQLITE_CORRUPT",
        message: "database disk image is malformed",
      })
    ).toBe("corrupt");
    expect(
      classifySqliteOpenError({ code: "SQLITE_CANTOPEN", message: "unable to open database file" })
    ).toBe("unreadable");
  });

  test("sqliteUniqueField maps name nocase index failures to name", () => {
    expect(
      sqliteUniqueField({
        code: "SQLITE_CONSTRAINT_UNIQUE",
        message: "UNIQUE constraint failed: idx_deck_templates_name_nocase",
      })
    ).toBe("name");
    expect(
      sqliteUniqueField({
        code: "SQLITE_CONSTRAINT_UNIQUE",
        message: "UNIQUE constraint failed: deck_templates.name",
      })
    ).toBe("name");
  });
});

describe("DeckCatalog row parsing", () => {
  test("bad cards JSON does not abort listTemplates", () => {
    withTempCatalog(({ catalog }) => {
      catalog.insertTemplate({
        id: "alpha",
        name: "Alpha",
        cards: [{ name: "A" }],
      });
      catalog.insertTemplate({
        id: "beta",
        name: "Beta",
        cards: [{ name: "B" }],
      });
      catalog.db
        .query(`UPDATE deck_templates SET cards = ? WHERE id = ?`)
        .run("{not-json", "alpha");

      const list = catalog.listTemplates();
      expect(list).toHaveLength(2);
      const alpha = list.find((row) => row.id === "alpha");
      const beta = list.find((row) => row.id === "beta");
      expect(alpha.cardsError).toBe("invalid_json");
      expect(alpha.cards).toEqual([]);
      expect(beta.cards[0].name).toBe("B");
      expect(beta.cardsError).toBeUndefined();
      expect(catalog.getTemplate("alpha").cardsError).toBe("invalid_json");
    });
  });

  test("non-array cards JSON is surfaced without throwing", () => {
    withTempCatalog(({ catalog }) => {
      catalog.insertTemplate({
        id: "obj",
        name: "Obj",
        cards: [{ name: "A" }],
      });
      catalog.db
        .query(`UPDATE deck_templates SET cards = ? WHERE id = ?`)
        .run(JSON.stringify({ nope: true }), "obj");
      const template = catalog.getTemplate("obj");
      expect(template.cardsError).toBe("not_array");
      expect(template.cards).toEqual([]);
    });
  });

  test("enabled values other than 1 normalize to disabled", () => {
    expect(normalizeEnabled(1)).toBe(1);
    expect(normalizeEnabled(0)).toBe(0);
    expect(normalizeEnabled(2)).toBe(0);
    expect(normalizeEnabled(null)).toBe(0);
    expect(normalizeEnabled(undefined)).toBe(0);
    expect(isCatalogEnabled(1)).toBe(true);
    expect(isCatalogEnabled(0)).toBe(false);
    expect(isCatalogEnabled(2)).toBe(false);
    expect(isEnabled({ enabled: 1 })).toBe(true);
    expect(isEnabled({ enabled: 0 })).toBe(false);
    expect(isEnabled({ enabled: 2 })).toBe(false);
    expect(isEnabled(null)).toBe(false);

    const fromNull = parseTemplateRow({
      id: "n",
      name: "N",
      enabled: null,
      created_by: "seed",
      created_at: "t",
      updated_at: "t",
      cards: "[]",
    });
    expect(fromNull.enabled).toBe(0);

    withTempCatalog(({ catalog }) => {
      catalog.insertTemplate({
        id: "flag",
        name: "Flag",
        cards: [{ name: "A" }],
        enabled: 1,
      });
      catalog.db
        .query(`UPDATE deck_templates SET enabled = 2 WHERE id = ?`)
        .run("flag");
      const template = catalog.getTemplate("flag");
      expect(template.enabled).toBe(0);
      const listed = catalog.listTemplates();
      expect(listed[0].enabled).toBe(0);
    });
  });
});

function sampleCards() {
  return [{ name: "A", description: "", type: "", suit: "", value: "", url: null, format: "A" }];
}

function hasNameNocaseIndex(catalog) {
  return (
    catalog.db
      .query(
        `SELECT 1 AS ok FROM sqlite_master WHERE type = 'index' AND name = ?`
      )
      .get(NAME_NOCASE_INDEX) != null
  );
}

describe("NOCASE name unique index migration", () => {
  test("opening a catalog with BINARY case-variant names does not create the index or throw", () => {
    withTempCatalog(({ catalog }) => {
      catalog.insertTemplate({ id: "foo-upper", name: "Foo", cards: sampleCards() });
      catalog.insertTemplate({ id: "foo-lower", name: "foo", cards: sampleCards() });
      expect(catalog.count()).toBe(2);
      expect(hasNameNocaseIndex(catalog)).toBe(false);

      const listed = catalog.listTemplates().map((row) => row.name).sort();
      expect(listed).toEqual(["Foo", "foo"]);
      expect(catalog.hasName("FOO")).toBe(true);
    });
  });

  test("ensure creates the index when names are unique under NOCASE", () => {
    withTempCatalog(({ catalog }) => {
      catalog.insertTemplate({ id: "foo", name: "Foo", cards: sampleCards() });
      catalog.insertTemplate({ id: "bar", name: "Bar", cards: sampleCards() });

      const first = catalog.ensureNameNocaseUniqueIndex();
      expect(first.status).toBe("created");
      expect(first.collisions).toEqual([]);
      expect(hasNameNocaseIndex(catalog)).toBe(true);

      const second = catalog.ensureNameNocaseUniqueIndex();
      expect(second.status).toBe("already");
      expect(catalog.count()).toBe(2);

      expect(() =>
        catalog.insertTemplate({ id: "foo-2", name: "foo", cards: sampleCards() })
      ).toThrow();
      expect(catalog.hasId("foo-2")).toBe(false);
      expect(catalog.getTemplate("foo").name).toBe("Foo");
    });
  });

  test("ensure skips when case-variant names already exist and keeps every row", () => {
    withTempCatalog(({ catalog }) => {
      catalog.insertTemplate({ id: "foo-upper", name: "Foo", cards: sampleCards() });
      catalog.insertTemplate({ id: "foo-lower", name: "foo", cards: sampleCards() });
      catalog.insertTemplate({ id: "bar-mixed", name: "Bar", cards: sampleCards() });
      catalog.insertTemplate({ id: "bar-upper", name: "BAR", cards: sampleCards() });
      catalog.insertTemplate({ id: "solo", name: "Solo", cards: sampleCards() });

      const first = catalog.ensureNameNocaseUniqueIndex();
      expect(first.status).toBe("skipped");
      expect(hasNameNocaseIndex(catalog)).toBe(false);
      expect(first.collisions).toHaveLength(2);
      const collisionIds = first.collisions.flatMap((group) => group.ids).sort();
      expect(collisionIds).toEqual([
        "bar-mixed",
        "bar-upper",
        "foo-lower",
        "foo-upper",
      ]);
      expect(catalog.count()).toBe(5);
      expect(catalog.getTemplate("foo-upper").name).toBe("Foo");
      expect(catalog.getTemplate("foo-lower").name).toBe("foo");
      expect(catalog.getTemplate("bar-mixed").name).toBe("Bar");
      expect(catalog.getTemplate("bar-upper").name).toBe("BAR");
      expect(catalog.getTemplate("solo").name).toBe("Solo");

      const second = catalog.ensureNameNocaseUniqueIndex();
      expect(second.status).toBe("skipped");
      expect(hasNameNocaseIndex(catalog)).toBe(false);
      expect(catalog.count()).toBe(5);
      expect(formatNameNocaseIndexSkip(first.collisions)).toMatch(
        /all rows kept/i
      );
      expect(formatNameNocaseIndexSkip(first.collisions)).toMatch(/Foo|foo/);
    });
  });
});

