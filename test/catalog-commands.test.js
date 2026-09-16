const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const path = require("path");
const Catalog = require("../slashcommands/genericgame/catalog");
const Cards = require("../slashcommands/genericgame/cards");
const DeckCatalog = require("../db/deckCatalog.js");
const { seedDeckCatalog } = require("../db/seedDeckCatalog.js");
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
const {
  HUGE_DECK_ID,
  HUGE_DECK_NAME,
  HUGE_DECK_CARD_COUNT,
  HUGE_DECK_LONG_URL_INDEXES,
  HUGE_LIST_TEMPLATE_COUNT,
  hugeListOverflowMarkers,
  hugeShowOverflowMarkers,
  insertHugeListTemplates,
  insertHugeShowTemplate,
  payloadCharCount,
  payloadsHaveBrokenMarkdownImageLinks,
} = require("./helpers/hugeCatalogDeck");
const {
  EMBED_DESCRIPTION_LIMIT,
  EMBED_TOTAL_CHAR_LIMIT,
  EMBEDS_PER_MESSAGE,
} = require("../modules/DiscordEmbeds");

const OWNER = createUser({ id: "owner-1", username: "Owner" });
const SNOWFLAKE_CREATOR = "123456789012345678";

async function runCatalog(harness) {
  const command = new Catalog(harness.client);
  await command.execute(harness.interaction);
}

function primaryPayload(harness) {
  return harness.calls.editReply[0] || harness.calls.reply[0];
}

function sentCatalogPayloads(harness) {
  const primary = primaryPayload(harness);
  return primary ? [primary, ...harness.calls.followUp] : [...harness.calls.followUp];
}

function expectPayloadsWithinDiscordLimits(payloads, { ephemeral = false } = {}) {
  for (const payload of payloads) {
    if (ephemeral) {
      expect(payload.flags).toBe(MessageFlags.Ephemeral);
    }
    expect(payload.embeds.length).toBeLessThanOrEqual(EMBEDS_PER_MESSAGE);
    expect(payloadCharCount(payload)).toBeLessThanOrEqual(EMBED_TOTAL_CHAR_LIMIT);
    for (const embed of payload.embeds) {
      expect((embed.data.description || "").length).toBeLessThanOrEqual(
        EMBED_DESCRIPTION_LIMIT
      );
    }
  }
}

function expectOverflowMarkers(text, markers) {
  for (const marker of markers) {
    expect(text).toContain(marker);
  }
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

  test("list still works when BINARY-unique names collide under NOCASE", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        try {
          catalog.insertTemplate({
            id: "foo-upper",
            name: "Foo",
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
          });
          catalog.insertTemplate({
            id: "foo-lower",
            name: "foo",
            cards: [
              {
                name: "B",
                description: "",
                type: "",
                suit: "",
                value: "",
                url: null,
                format: "A",
              },
            ],
          });
        } finally {
          catalog.close();
        }

        await runCatalog(harness);
        const text = collectedReplyText(harness);
        expect(text).toContain("Foo (foo-upper)");
        expect(text).toContain("foo (foo-lower)");
        expect(text.toLowerCase()).not.toMatch(/unreadable|could not be read/);
        expect(text).not.toContain("Something went wrong");
      }
    );
  });

  test("corrupt catalog db does not hint /migrate", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        fs.writeFileSync(
          path.join(harness.dataDir, "deck_catalog.sqlite"),
          "this is not a sqlite database\n"
        );
        await runCatalog(harness);
        const text = harness.lastContent();
        expect(text).not.toContain("deck-catalog");
        expect(text).not.toContain("Something went wrong");
        expect(text.toLowerCase()).toMatch(/corrupt|not a valid sqlite/);
      }
    );
  });

  test("list keeps other templates when one has unreadable cards JSON", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        seedDeckCatalog();
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.db
          .query(`UPDATE deck_templates SET cards = ? WHERE id = ?`)
          .run("{not-json", "standard");
        catalog.close();

        await runCatalog(harness);
        const text = collectedReplyText(harness);
        expect(text).toContain("unreadable cards");
        expect(text).toContain("Brass Birmingham - 2 Players (brass-two)");
        expect(text).not.toContain("Something went wrong");
      }
    );
  });

  test("show surfaces unreadable cards instead of a generic error", async () => {
    await withHarness(
      {
        user: OWNER,
        options: { subcommand: "show", strings: { id: "standard" } },
      },
      async (harness) => {
        seedDeckCatalog();
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.db
          .query(`UPDATE deck_templates SET cards = ? WHERE id = ?`)
          .run("{not-json", "standard");
        catalog.close();

        await runCatalog(harness);
        expect(harness.lastContent()).toMatch(/unreadable cards data/i);
        expect(harness.lastContent()).not.toContain("Something went wrong");
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
        expect(harness.lastContent()).toContain("no longer appear");

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

  test("disable and enable share one flag-setter and skip work when already set", async () => {
    const Disable = require("../subcommands/catalog/disable.js");
    const Enable = require("../subcommands/catalog/enable.js");
    const { disable, enable, setCatalogEnabled } = require("../subcommands/catalog/setEnabled.js");
    expect(Disable).toBe(disable);
    expect(Enable).toBe(enable);
    expect(typeof setCatalogEnabled).toBe("function");

    await withHarness(
      {
        user: OWNER,
        options: { subcommand: "disable", strings: { id: "standard" } },
      },
      async (harness) => {
        seedDeckCatalog();
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.setEnabled("standard", 0);
        catalog.close();

        await runCatalog(harness);
        expect(harness.lastContent()).toContain("already disabled");

        harness.interaction.options.getSubcommand = () => "enable";
        await runCatalog(harness);
        expect(harness.lastContent()).toContain("Enabled `standard`");

        await runCatalog(harness);
        expect(harness.lastContent()).toContain("already enabled");
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

  test("publish uses draw, discard, and hands when allCards is empty", async () => {
    const draw = createCard({ id: "d1", name: "Draw", origin: "Main" });
    const discard = createCard({ id: "d2", name: "Discard", origin: "Main" });
    const hand = createCard({ id: "h1", name: "Hand", origin: "Main" });
    const game = createActiveGame({
      players: [
        createPlayer({
          userId: "owner-1",
          name: "Owner",
          order: 0,
          hands: {
            main: [hand],
            played: [],
            passed: [],
            received: [],
            simultaneous: [],
          },
        }),
      ],
      decks: [createDeck({ name: "Main", draw: [draw], discard: [discard] })],
    });
    game.decks[0].allCards = [];

    await withHarness(
      {
        user: OWNER,
        gameData: game,
        options: {
          subcommand: "publish",
          strings: { deck: "Main", id: "live-set", name: "Live Set" },
        },
      },
      async (harness) => {
        seedDeckCatalog();
        await runCatalog(harness);
        expect(harness.lastContent()).toContain("Published `live-set`");
        expect(harness.lastContent()).toContain("3 cards");
        expect(harness.lastContent()).toContain("• Draw");
        expect(harness.lastContent()).toContain("• Discard");
        expect(harness.lastContent()).toContain("• Hand");

        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        try {
          expect(catalog.getTemplate("live-set").cards.map((card) => card.name)).toEqual([
            "Draw",
            "Discard",
            "Hand",
          ]);
        } finally {
          catalog.close();
        }
      }
    );
  });

  test("publish cannot claim an official seed id on an empty catalog", async () => {
    await withHarness(
      {
        user: OWNER,
        gameData: gameWithDeck([createCard()]),
        options: {
          subcommand: "publish",
          strings: { deck: "Main", id: "standard", name: "Hijack Standard" },
        },
      },
      async (harness) => {
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        expect(catalog.count()).toBe(0);
        catalog.close();

        await runCatalog(harness);
        expect(harness.lastContent()).toMatch(/reserved/i);
        expect(harness.lastContent()).toContain("standard");
        expect(harness.lastContent()).toContain("deck-catalog");

        const after = new DeckCatalog({ dataDir: harness.dataDir });
        try {
          expect(after.hasId("standard")).toBe(false);
          expect(after.count()).toBe(0);
        } finally {
          after.close();
        }
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

  test("show autocomplete filters by focus so names after the first 25 are still reachable", async () => {
    await withHarness(
      {
        user: OWNER,
        isAutocomplete: true,
        options: {
          subcommand: "show",
          focused: "",
          focusedName: "id",
        },
      },
      async (harness) => {
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        try {
          for (let i = 0; i < 30; i++) {
            catalog.insertTemplate({
              id: `aaa-${String(i).padStart(2, "0")}`,
              name: `AAA ${String(i).padStart(2, "0")}`,
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
            });
          }
          catalog.insertTemplate({
            id: "zebra-late",
            name: "Zebra Late",
            cards: [
              {
                name: "Z",
                description: "",
                type: "",
                suit: "",
                value: "",
                url: null,
                format: "A",
              },
            ],
          });
        } finally {
          catalog.close();
        }

        await runCatalog(harness);
        const emptyValues = harness.calls.respond[0].map((choice) => choice.value);
        expect(emptyValues).toHaveLength(25);
        expect(emptyValues).not.toContain("zebra-late");

        harness.calls.respond.length = 0;
        harness.interaction.options.getFocused = (whole = false) =>
          whole ? { name: "id", value: "zeb" } : "zeb";
        await runCatalog(harness);
        const focused = harness.calls.respond[0];
        expect(focused.map((choice) => choice.value)).toContain("zebra-late");
        expect(focused.length).toBeLessThanOrEqual(25);
      }
    );
  });

  test("publish deck autocomplete filters by focus and caps at 25", async () => {
    const decks = Array.from({ length: 30 }, (_, i) =>
      createDeck({
        name: `Alpha ${String(i).padStart(2, "0")}`,
        draw: [createCard({ id: `c${i}`, name: "A" })],
      })
    );
    decks.push(
      createDeck({
        name: "Zeta Only",
        draw: [createCard({ id: "z", name: "Z" })],
      })
    );
    await withHarness(
      {
        user: OWNER,
        isAutocomplete: true,
        gameData: createActiveGame({ decks }),
        options: {
          subcommand: "publish",
          focused: "",
          focusedName: "deck",
        },
      },
      async (harness) => {
        await runCatalog(harness);
        expect(harness.calls.respond[0]).toHaveLength(25);
        expect(
          harness.calls.respond[0].map((choice) => choice.value)
        ).not.toContain("Zeta Only");

        harness.calls.respond.length = 0;
        harness.interaction.options.getFocused = (whole = false) =>
          whole ? { name: "deck", value: "only" } : "only";
        await runCatalog(harness);
        expect(harness.calls.respond[0].map((choice) => choice.value)).toEqual([
          "Zeta Only",
        ]);
        expect(harness.calls.respond[0][0].name.startsWith("only")).toBe(true);
        expect(harness.calls.respond[0][0].name).toContain("Zeta Only");
      }
    );
  });

  test("enabled=2 is listed disabled and offered by enable autocomplete", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        seedDeckCatalog();
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.db
          .query(`UPDATE deck_templates SET enabled = 2 WHERE id = ?`)
          .run("standard");
        catalog.close();

        await runCatalog(harness);
        const text = collectedReplyText(harness);
        expect(text).toContain("Disabled (1)");
        const disabledEmbed = primaryPayload(harness).embeds.find((embed) =>
          String(embed.data.title).startsWith("Disabled")
        );
        expect(disabledEmbed.data.description).toContain("(standard)");
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
        catalog.db
          .query(`UPDATE deck_templates SET enabled = 2 WHERE id = ?`)
          .run("standard");
        catalog.close();

        await runCatalog(harness);
        expect(harness.calls.respond[0].map((choice) => choice.value)).toEqual([
          "standard",
        ]);
      }
    );

    await withHarness(
      {
        user: OWNER,
        isAutocomplete: true,
        options: {
          subcommand: "disable",
          focused: "stand",
          focusedName: "id",
        },
      },
      async (harness) => {
        seedDeckCatalog();
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.db
          .query(`UPDATE deck_templates SET enabled = 2 WHERE id = ?`)
          .run("standard");
        catalog.close();

        await runCatalog(harness);
        const values = harness.calls.respond[0].map((choice) => choice.value);
        expect(values).not.toContain("standard");
      }
    );
  });

  test("/cards deck new autocomplete reads enabled catalog templates plus custom-csv", async () => {
    await withHarness(
      {
        isAutocomplete: true,
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: { cardset: "only" },
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
        expect(values).toContain("only-in-sqlite");
        expect(values).not.toContain("standard");

        harness.interaction.options.getString = (name) =>
          name === "cardset" ? "custom" : null;
        harness.calls.respond.length = 0;
        await command.execute(harness.interaction);
        expect(harness.calls.respond[0].map((choice) => choice.value)).toContain(
          "custom-csv"
        );

        harness.interaction.options.getString = (name) =>
          name === "cardset" ? "standard" : null;
        harness.calls.respond.length = 0;
        await command.execute(harness.interaction);
        expect(harness.calls.respond[0].map((choice) => choice.value)).not.toContain(
          "standard"
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

  test("show huge deck keeps the first page under Discord limits and follow-ups the rest", async () => {
    await withHarness(
      {
        user: OWNER,
        options: { subcommand: "show", strings: { id: HUGE_DECK_ID } },
      },
      async (harness) => {
        insertHugeShowTemplate(harness.dataDir);
        await runCatalog(harness);

        const primary = primaryPayload(harness);
        expect(primary.embeds[0].data.title).toBe(HUGE_DECK_NAME);
        expect(payloadCharCount(primary)).toBeGreaterThan(
          EMBED_TOTAL_CHAR_LIMIT / 2
        );
        expect(harness.calls.followUp.length).toBeGreaterThanOrEqual(1);

        const sent = sentCatalogPayloads(harness);
        expectPayloadsWithinDiscordLimits(sent, { ephemeral: true });

        const text = collectedReplyText(harness);
        expect(text).toContain(`\`${HUGE_DECK_ID}\``);
        expect(text).toContain(`${HUGE_DECK_CARD_COUNT} cards`);
        // Tail + long-URL indexes (0, 50, 299): header counts alone do not
        // prove overflow lines survived a truncation after the first follow-up.
        expectOverflowMarkers(text, hugeShowOverflowMarkers());
        expect(HUGE_DECK_LONG_URL_INDEXES).toEqual([0, 50, HUGE_DECK_CARD_COUNT - 1]);
        expect(payloadsHaveBrokenMarkdownImageLinks(sent)).toBe(false);
        expect(text).not.toMatch(/\[image\]\([^)\n]*$/m);
        expect(text).not.toContain("[image](https://example.test/huge-regression/");
        expect(text).not.toContain("u".repeat(80));
      }
    );
  });

  test("show huge-deck follow-up failure does not editReply the first page away", async () => {
    await withHarness(
      {
        user: OWNER,
        options: { subcommand: "show", strings: { id: HUGE_DECK_ID } },
      },
      async (harness) => {
        insertHugeShowTemplate(harness.dataDir);
        harness.interaction.followUp = async () => {
          throw new Error("discord follow-up failed");
        };

        await runCatalog(harness);
        const primary = primaryPayload(harness);
        expect(primary.embeds[0].data.title).toBe(HUGE_DECK_NAME);
        expect(collectedReplyText(harness)).toContain("Huge Card 000");
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

  test("list huge template names overflow into follow-ups without an illegal first page", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        insertHugeListTemplates(harness.dataDir);
        await runCatalog(harness);
        expect(harness.calls.followUp.length).toBeGreaterThanOrEqual(1);
        const sent = sentCatalogPayloads(harness);
        expectPayloadsWithinDiscordLimits(sent, { ephemeral: true });
        const text = collectedReplyText(harness);
        expect(text).toContain(`Enabled (${HUGE_LIST_TEMPLATE_COUNT})`);
        expect(text).toContain("Disabled (0)");
        expectOverflowMarkers(text, hugeListOverflowMarkers());
      }
    );
  });

  test("list huge-template follow-up failure does not editReply the first page away", async () => {
    await withHarness(
      { user: OWNER, options: { subcommand: "list" } },
      async (harness) => {
        insertHugeListTemplates(harness.dataDir);
        harness.interaction.followUp = async () => {
          throw new Error("discord follow-up failed");
        };

        await runCatalog(harness);
        const primary = primaryPayload(harness);
        expect(primary.embeds[0].data.title).toMatch(/^Enabled \(/);
        expect(collectedReplyText(harness)).toContain("Huge List 000");
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
