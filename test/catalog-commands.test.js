const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const path = require("path");
const Catalog = require("../slashcommands/genericgame/catalog");
const Cards = require("../slashcommands/genericgame/cards");
const DeckCatalog = require("../db/deckCatalog.js");
const { seedDeckCatalog } = require("../db/seedDeckCatalog.js");
const GameDB = require("../db/anygame.js");
const {
  collectedReplyText,
  createActiveGame,
  createCard,
  createDeck,
  createPlayer,
  createUser,
  withHarness,
} = require("./helpers/harness");

const OWNER = createUser({ id: "owner-1", username: "Owner" });

async function runCatalog(harness) {
  const command = new Catalog(harness.client);
  await command.execute(harness.interaction);
}

function gameWithDeck(cards) {
  return createActiveGame({
    players: [createPlayer({ userId: "owner-1", name: "Owner", order: 0 })],
    decks: [createDeck({ name: "Main", draw: cards, discard: [] })],
  });
}

describe("/catalog command handlers", () => {
  test("rejects users who are not the bot owner", async () => {
    await withHarness(
      { options: { subcommand: "list" } },
      async (harness) => {
        await runCatalog(harness);
        expect(harness.lastContent()).toBe(
          "You do not have permission to use this command. (Bot Owner Only)"
        );
      }
    );
  });

  test("asks for /migrate when the catalog db is missing", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        expect(
          fs.existsSync(path.join(harness.dataDir, "deck_catalog.sqlite"))
        ).toBe(false);
        await runCatalog(harness);
        expect(harness.lastContent()).toContain("job `deck-catalog`");
      }
    );
  });

  test("list shows seeded templates including standard", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        seedDeckCatalog();
        await runCatalog(harness);
        const text = collectedReplyText(harness);
        expect(text).toContain("standard — Standard 52 Card Poker Deck — enabled");
        expect(text).toMatch(/Catalog templates \(6\d\)/);
        expect(text.toLowerCase()).toContain("cards");
      }
    );
  });

  test("show standard lists poker cards", async () => {
    await withHarness(
      {
        user: OWNER,
        options: { subcommand: "show", strings: { id: "standard" } },
      },
      async (harness) => {
        seedDeckCatalog();
        await runCatalog(harness);
        const text = collectedReplyText(harness);
        expect(text).toContain("Standard 52 Card Poker Deck");
        expect(text).toContain("`standard`");
        expect(text).toContain("Enabled: enabled");
        expect(text).toContain("Cards: 52");
        expect(text).toContain("A of ♣");
        expect(text).toContain("K of ♠");
      }
    );
  });

  test("disable then enable flips the flag without rewriting cards", async () => {
    await withHarness(
      {
        user: OWNER,
        options: { subcommand: "disable", strings: { id: "standard" } },
      },
      async (harness) => {
        seedDeckCatalog();
        let before;
        {
          const snapshot = new DeckCatalog({ dataDir: harness.dataDir });
          before = snapshot.getTemplate("standard");
          snapshot.close();
        }

        await runCatalog(harness);
        expect(harness.lastContent()).toContain("Disabled `standard`");
        expect(harness.lastContent()).toContain("still JS");

        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        try {
          const disabled = catalog.getTemplate("standard");
          expect(disabled.enabled).toBe(0);
          expect(disabled.cards).toEqual(before.cards);
        } finally {
          catalog.close();
        }

        harness.interaction.options.getSubcommand = () => "enable";
        await runCatalog(harness);
        expect(harness.lastContent()).toContain("Enabled `standard`");

        const catalogAfter = new DeckCatalog({ dataDir: harness.dataDir });
        try {
          const enabled = catalogAfter.getTemplate("standard");
          expect(enabled.enabled).toBe(1);
          expect(enabled.cards).toEqual(before.cards);
        } finally {
          catalogAfter.close();
        }
      }
    );
  });

  test("publish saves allCards as a new id and refuses overwrites", async () => {
    const cards = [
      createCard({
        id: "c1",
        name: "Ace",
        origin: "Main",
        url: "https://example.test/ace.png",
      }),
      createCard({ id: "c2", name: "King", origin: "Main" }),
    ];
    await withHarness(
      {
        user: OWNER,
        gameData: gameWithDeck(cards),
        options: {
          subcommand: "publish",
          strings: {
            deck: "Main",
            id: "my-custom",
            name: "My Custom",
          },
        },
      },
      async (harness) => {
        seedDeckCatalog();
        let seedCount;
        {
          const snapshot = new DeckCatalog({ dataDir: harness.dataDir });
          seedCount = snapshot.count();
          snapshot.close();
        }

        await runCatalog(harness);
        expect(harness.lastContent()).toContain("Published **My Custom** (`my-custom`) with 2 cards");
        expect(harness.lastContent()).toContain("Ace (https://example.test/ace.png)");
        expect(harness.lastContent()).toContain("FUR-38");

        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        try {
          const published = catalog.getTemplate("my-custom");
          expect(published.created_by).toBe("owner-1");
          expect(published.cards).toHaveLength(2);
          expect(published.cards[0]).not.toHaveProperty("id");
          expect(published.cards[0]).not.toHaveProperty("origin");
          expect(catalog.count()).toBe(seedCount + 1);
        } finally {
          catalog.close();
        }

        await runCatalog(harness);
        expect(harness.lastContent()).toContain("already exists");
      }
    );
  });

  test("publish refuses reserved ids, missing decks, and empty allCards", async () => {
    await withHarness(
      {
        user: OWNER,
        options: {
          subcommand: "publish",
          strings: { deck: "Main", id: "ok-id", name: "Nope" },
        },
      },
      async (harness) => {
        seedDeckCatalog();
        await runCatalog(harness);
        expect(harness.lastContent().toLowerCase()).toContain("no game");
      }
    );

    await withHarness(
      {
        user: OWNER,
        gameData: gameWithDeck([createCard()]),
        options: {
          subcommand: "publish",
          strings: { deck: "Missing", id: "custom-csv", name: "Nope" },
        },
      },
      async (harness) => {
        seedDeckCatalog();
        await runCatalog(harness);
        expect(harness.lastContent()).toContain("No deck named");
      }
    );

    await withHarness(
      {
        user: OWNER,
        gameData: gameWithDeck([createCard()]),
        options: {
          subcommand: "publish",
          strings: { deck: "Main", id: "custom-csv", name: "Nope" },
        },
      },
      async (harness) => {
        seedDeckCatalog();
        await runCatalog(harness);
        expect(harness.lastContent()).toContain("reserved");
      }
    );

    const emptyDeckGame = createActiveGame({
      decks: [createDeck({ name: "Empty", draw: [], discard: [] })],
    });
    emptyDeckGame.decks[0].allCards = [];
    await withHarness(
      {
        user: OWNER,
        gameData: emptyDeckGame,
        options: {
          subcommand: "publish",
          strings: { deck: "Empty", id: "empty-set", name: "Empty Set" },
        },
      },
      async (harness) => {
        seedDeckCatalog();
        await runCatalog(harness);
        expect(harness.lastContent()).toContain("allCards");
      }
    );
  });

  test("show autocomplete includes disabled templates; disable/enable filter by flag", async () => {
    await withHarness(
      {
        user: OWNER,
        isAutocomplete: true,
        options: {
          subcommand: "show",
          strings: { id: "stand" },
          focused: "stand",
          focusedName: "id",
        },
      },
      async (harness) => {
        seedDeckCatalog();
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.setEnabled("standard", 0);
        catalog.close();

        await runCatalog(harness);
        const names = harness.calls.respond[0].map((choice) => choice.value);
        expect(names).toContain("standard");
      }
    );

    await withHarness(
      {
        user: OWNER,
        isAutocomplete: true,
        options: {
          subcommand: "disable",
          focused: "",
          focusedName: "id",
        },
      },
      async (harness) => {
        seedDeckCatalog();
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.setEnabled("standard", 0);
        catalog.close();

        await runCatalog(harness);
        const values = harness.calls.respond[0].map((choice) => choice.value);
        expect(values).not.toContain("standard");
        expect(values.length).toBeGreaterThan(0);
      }
    );

    await withHarness(
      {
        user: OWNER,
        isAutocomplete: true,
        options: {
          subcommand: "enable",
          focused: "stand",
          focusedName: "id",
        },
      },
      async (harness) => {
        seedDeckCatalog();
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.setEnabled("standard", 0);
        catalog.close();

        await runCatalog(harness);
        expect(harness.calls.respond[0].map((choice) => choice.value)).toEqual([
          "standard",
        ]);
      }
    );
  });

  test("/cards deck new autocomplete still reads CurrentCardList JS only", async () => {
    await withHarness(
      {
        isAutocomplete: true,
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: { cardset: "standard" },
        },
      },
      async (harness) => {
        seedDeckCatalog();
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.setEnabled("standard", 0);
        catalog.insertTemplate({
          id: "only-in-sqlite",
          name: "Only In Sqlite",
          cards: [{ name: "X", description: "", type: "", suit: "", value: "", url: null, format: "A" }],
        });
        catalog.close();

        const command = new Cards(harness.client);
        await command.execute(harness.interaction);
        const values = harness.calls.respond[0].map((choice) => choice.value);
        expect(values).toContain("standard");
        expect(values).not.toContain("only-in-sqlite");
        expect(GameDB.CurrentCardList.some(([, id]) => id === "standard")).toBe(
          true
        );
      }
    );
  });
});
