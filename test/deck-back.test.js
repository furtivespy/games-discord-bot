const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Database } = require("bun:sqlite");
const DeckCatalog = require("../db/deckCatalog.js");
const DeckBack = require("../modules/DeckBack");
const { buildPublishPayload } = require("../db/catalogPublish.js");

function withTempDir(run) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-back-"));
  try {
    return run(dataDir);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

describe("DeckBack helper", () => {
  test("reads backUrl and legacy aliases, ignoring blanks", () => {
    expect(DeckBack.readBackUrl(null)).toBeNull();
    expect(DeckBack.readBackUrl({ backUrl: "  " })).toBeNull();
    expect(DeckBack.readBackUrl({ backUrl: "https://example.test/a.png" })).toBe(
      "https://example.test/a.png"
    );
    expect(
      DeckBack.readBackUrl({ cardBackUrl: "https://example.test/alias.png" })
    ).toBe("https://example.test/alias.png");
    expect(
      DeckBack.readBackUrl({ backImage: "https://example.test/image.png" })
    ).toBe("https://example.test/image.png");
  });

  test("parses set, clear, and invalid URLs", () => {
    expect(DeckBack.parseBackUrlInput(null)).toEqual({ present: false });
    expect(DeckBack.parseBackUrlInput("clear")).toEqual({
      present: true,
      backUrl: null,
      cleared: true,
    });
    expect(DeckBack.parseBackUrlInput(" NONE ")).toEqual({
      present: true,
      backUrl: null,
      cleared: true,
    });
    expect(DeckBack.parseBackUrlInput("https://example.test/back.png")).toEqual({
      present: true,
      backUrl: "https://example.test/back.png",
      cleared: false,
    });
    expect(DeckBack.parseBackUrlInput("ftp://example.test/back.png").error).toBe(
      DeckBack.INVALID_MESSAGE
    );
    expect(DeckBack.parseBackUrlInput("not a url").error).toBe(
      DeckBack.INVALID_MESSAGE
    );
  });

  test("applyBackUrl writes the canonical field and drops aliases", () => {
    const deck = {
      backUrl: "https://old.example/a.png",
      cardBackUrl: "https://old.example/b.png",
      backImage: "https://old.example/c.png",
    };
    DeckBack.applyBackUrl(deck, "https://example.test/new.png");
    expect(deck).toEqual({ backUrl: "https://example.test/new.png" });
    DeckBack.applyBackUrl(deck, null);
    expect(deck.backUrl).toBeNull();
    expect(deck).not.toHaveProperty("cardBackUrl");
  });
});

describe("catalog deck back column", () => {
  test("opening a pre-back_url catalog adds the column and keeps existing cards", () => {
    withTempDir((dataDir) => {
      const dbPath = path.join(dataDir, DeckCatalog.DECK_CATALOG_FILENAME);
      const db = new Database(dbPath, { create: true });
      db.exec(`
        CREATE TABLE deck_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_by TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          cards TEXT NOT NULL
        );
      `);
      db.query(
        `INSERT INTO deck_templates (id, name, enabled, created_by, created_at, updated_at, cards)
         VALUES (?, ?, 1, 'seed', datetime('now'), datetime('now'), ?)`
      ).run("standard", "Standard", JSON.stringify([{ name: "Ace" }]));
      db.close();

      const catalog = new DeckCatalog({ dataDir });
      try {
        const columns = catalog.db
          .query(`PRAGMA table_info(deck_templates)`)
          .all()
          .map((column) => column.name);
        expect(columns).toContain("back_url");
        const template = catalog.getTemplate("standard");
        expect(template.cards).toEqual([{ name: "Ace" }]);
        expect(template.backUrl).toBeNull();

        expect(catalog.setBackUrl("standard", "https://example.test/back.png")).toBe(
          true
        );
        const updated = catalog.getTemplate("standard");
        expect(updated.backUrl).toBe("https://example.test/back.png");
        expect(updated.cards).toEqual([{ name: "Ace" }]);
        expect(catalog.setBackUrl("missing", "https://example.test/back.png")).toBe(
          false
        );
      } finally {
        catalog.close();
      }

      const again = new DeckCatalog({ dataDir });
      try {
        expect(again.getTemplate("standard").backUrl).toBe(
          "https://example.test/back.png"
        );
        expect(again.getTemplate("standard").cards).toEqual([{ name: "Ace" }]);
      } finally {
        again.close();
      }
    });
  });
});

describe("catalog publish payload includes deck back", () => {
  test("copies deck.backUrl onto the template payload", () => {
    const result = buildPublishPayload({
      id: "my-custom",
      name: "My Custom",
      createdBy: "owner-1",
      allCards: [
        {
          name: "Ace",
          description: "",
          type: "",
          suit: "",
          value: "",
          url: null,
          format: "A",
        },
      ],
      deck: { name: "Main", backUrl: "https://example.test/back.png" },
    });
    expect(result.ok).toBe(true);
    expect(result.payload.backUrl).toBe("https://example.test/back.png");
  });

  test("payload backUrl is null when the deck has none", () => {
    const result = buildPublishPayload({
      id: "my-custom",
      name: "My Custom",
      createdBy: "owner-1",
      allCards: [
        {
          name: "Ace",
          description: "",
          type: "",
          suit: "",
          value: "",
          url: null,
          format: "A",
        },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.payload.backUrl).toBeNull();
  });
});
