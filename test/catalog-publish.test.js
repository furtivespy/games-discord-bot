const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const DeckCatalog = require("../db/deckCatalog.js");
const { seedDeckCatalog } = require("../db/seedDeckCatalog.js");
const {
  buildPublishPayload,
  publishToCatalog,
  validateCatalogId,
} = require("../db/catalogPublish.js");

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

  test("rejects invalid slugs and reserved instance-only ids", () => {
    expect(validateCatalogId("Standard").ok).toBe(false);
    expect(validateCatalogId("has_underscore").error).toContain("^[a-z0-9-]{1,100}$");
    expect(validateCatalogId("custom-csv").code).toBe("reserved_id");
    expect(validateCatalogId("customempty").code).toBe("reserved_id");
    expect(
      buildPublishPayload({
        id: "ok-id",
        name: "Ok",
        allCards: [],
        createdBy: "1",
      }).code
    ).toBe("empty_cards");
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

  test("seed rows are not updated by publish", () => {
    withTempCatalog(({ catalog }) => {
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
      expect(overwriteSeed.code).toBe("duplicate_id");
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
});

describe("DeckCatalog.inspect", () => {
  test("does not create a catalog file and reports missing db", () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-inspect-"));
    try {
      const info = DeckCatalog.inspect({ dataDir });
      expect(info.exists).toBe(false);
      expect(info.hasSchema).toBe(false);
      expect(fs.existsSync(info.dbPath)).toBe(false);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
