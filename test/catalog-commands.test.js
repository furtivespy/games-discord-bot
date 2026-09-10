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
const { MessageFlags } = require("discord.js");

const OWNER = createUser({ id: "owner-1", username: "Owner" });
const SNOWFLAKE_CREATOR = "123456789012345678";

async function runCatalog(harness) {
  const command = new Catalog(harness.client);
  await command.execute(harness.interaction);
}

function primaryPayload(harness) {
  return harness.calls.editReply[0] || harness.calls.reply[0];
}

function insertPackedTemplates(dataDir, count, { enabled = 1 } = {}) {
  const catalog = new DeckCatalog({ dataDir });
  try {
    for (let i = 0; i < count; i++) {
      catalog.insertTemplate({
        id: `pack-${i}`,
        name: `Packed Deck ${String(i).padStart(3, "0")} ${"W".repeat(70)}`,
        cards: [
          {
            name: "A",
            description: "",
            type: "",
            suit: "",
            value: "",
            url: null,
            format: "A",
          },
        ],
        enabled,
      });
    }
  } finally {
    catalog.close();
  }
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
        expect(text).toContain("Standard 52 Card Poker Deck (standard): 52 cards, Layout A");
        expect(text).toContain("Brass Birmingham - 2 Players (brass-two): 40 cards, Layout B");
        expect(text).toContain("Enabled (");
        expect(text).toMatch(/Enabled \(6\d\)/);
        expect(text).toContain("Disabled (0)");
        expect(text).not.toMatch(/— enabled —/);
        expect(harness.calls.deferReply).toHaveLength(1);
        expect(harness.calls.deferReply[0].flags).toBe(MessageFlags.Ephemeral);
        const primary = primaryPayload(harness);
        expect(primary.embeds.length).toBeGreaterThanOrEqual(2);
        expect(primary.embeds[0].data.title).toMatch(/^Enabled \(/);
        expect(primary.embeds.at(-1).data.title).toMatch(/^Disabled \(/);
      }
    );
  });

  test("list splits disabled decks into a second embed", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        seedDeckCatalog();
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.setEnabled("standard", 0);
        catalog.close();

        await runCatalog(harness);
        const text = collectedReplyText(harness);
        expect(text).toContain("Disabled (1)");
        expect(text).toContain(
          "Standard 52 Card Poker Deck (standard): 52 cards, Layout A"
        );
        const primary = primaryPayload(harness);
        const disabledEmbed = primary.embeds.find((embed) =>
          String(embed.data.title).startsWith("Disabled")
        );
        expect(disabledEmbed.data.description).toContain(
          "Standard 52 Card Poker Deck (standard)"
        );
        const enabledEmbed = primary.embeds.find((embed) =>
          String(embed.data.title).startsWith("Enabled")
        );
        expect(enabledEmbed.data.description).not.toContain("(standard):");
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
        expect(text).toContain("Enabled");
        expect(text).toContain("52 cards");
        expect(text).toContain("Layout A");
        expect(text).toContain("• A of ♣");
        expect(text).toContain("• K of ♠");
        expect(harness.calls.deferReply).toHaveLength(1);
        expect(primaryPayload(harness).embeds.length).toBeGreaterThanOrEqual(1);
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
        expect(harness.lastContent()).toContain("Published `my-custom`");
        expect(harness.lastContent()).toContain("My Custom");
        expect(harness.lastContent()).toContain("2 cards");
        expect(harness.lastContent()).toContain("• Ace [image](https://example.test/ace.png)");
        expect(harness.lastContent()).toContain("• King");
        expect(harness.lastContent()).toContain("FUR-38");
        expect(harness.calls.reply[0].embeds[0].data.footer.text).toContain("FUR-38");

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

  test("list shows None when enabled is empty and disabled is not", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.insertTemplate({
          id: "only-off",
          name: "Only Disabled",
          cards: [
            {
              name: "X",
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
        catalog.close();

        await runCatalog(harness);
        const text = collectedReplyText(harness);
        expect(text).toContain("Enabled (0)");
        expect(text).toMatch(/Enabled \(0\)\nNone/);
        expect(text).toContain("Disabled (1)");
        expect(text).toContain("Only Disabled (only-off): 1 cards, Layout A");
        const primary = primaryPayload(harness);
        const enabledEmbed = primary.embeds.find((embed) =>
          String(embed.data.title).startsWith("Enabled")
        );
        expect(enabledEmbed.data.description).toBe("None");
      }
    );
  });

  test("list defers before fetching creator names", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.insertTemplate({
          id: "custom-one",
          name: "Custom One",
          cards: [
            {
              name: "X",
              description: "",
              type: "",
              suit: "",
              value: "",
              url: null,
              format: "A",
            },
          ],
          createdBy: SNOWFLAKE_CREATOR,
        });
        catalog.close();

        const order = [];
        const origDefer = harness.interaction.deferReply.bind(
          harness.interaction
        );
        harness.interaction.deferReply = async (payload) => {
          order.push("defer");
          return origDefer(payload);
        };
        harness.client.users.fetch = async (id) => {
          order.push("fetch");
          return { id, username: "Will", displayName: "Will" };
        };

        await runCatalog(harness);
        expect(order[0]).toBe("defer");
        expect(order).toContain("fetch");
        expect(order.indexOf("defer")).toBeLessThan(order.indexOf("fetch"));
        expect(collectedReplyText(harness)).toContain("by Will");
      }
    );
  });

  test("list sends overflow pages as follow-ups", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        insertPackedTemplates(harness.dataDir, 60);
        await runCatalog(harness);
        expect(harness.calls.followUp.length).toBeGreaterThanOrEqual(1);
        const text = collectedReplyText(harness);
        expect(text).toContain("Enabled (60)");
        expect(text).toContain("Packed Deck 000");
        expect(text).toContain("Disabled (0)");
      }
    );
  });

  test("follow-up failure does not editReply the first catalog page away", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        insertPackedTemplates(harness.dataDir, 60);
        harness.interaction.followUp = async () => {
          throw new Error("discord follow-up failed");
        };

        await runCatalog(harness);
        const primary = primaryPayload(harness);
        expect(primary.embeds[0].data.title).toMatch(/^Enabled \(/);
        expect(collectedReplyText(harness)).toContain("Packed Deck 000");
        expect(collectedReplyText(harness)).not.toContain(
          "Something went wrong"
        );
        const errorEdits = harness.calls.editReply.filter((payload) =>
          String(payload?.embeds?.[0]?.data?.description || "").includes(
            "Something went wrong"
          )
        );
        expect(errorEdits).toHaveLength(0);
      }
    );
  });
});
