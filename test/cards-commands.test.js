const { describe, expect, test } = require("bun:test");
const Cards = require("../slashcommands/genericgame/cards");
const DeckCatalog = require("../db/deckCatalog.js");
const { seedDeckCatalog } = require("../db/seedDeckCatalog.js");
const {
  collectedReplyText,
  createActiveGame,
  createCard,
  createDeck,
  createPlayer,
  withHarness,
} = require("./helpers/harness");

async function runCards(harness) {
  const command = new Cards(harness.client);
  await command.execute(harness.interaction);
}

function gameWithDeck({
  draw = [createCard({ id: "ace", name: "Ace" })],
  discard = [],
  hand = [],
} = {}) {
  return createActiveGame({
    players: [
      createPlayer({
        userId: "user-1",
        name: "Alice",
        order: 0,
        hands: {
          main: hand,
          played: [],
          passed: [],
          received: [],
          simultaneous: [],
        },
      }),
      createPlayer({ userId: "user-2", name: "Bob", order: 1 }),
    ],
    decks: [createDeck({ name: "Main", draw, discard })],
  });
}

describe("/cards command handlers", () => {
  test("help is reachable without a subcommand group", async () => {
    await withHarness(
      { options: { subcommand: "help" } },
      async (harness) => {
        await runCards(harness);
        expect(collectedReplyText(harness).toLowerCase()).toContain("card");
      }
    );
  });

  test("deck new creates a custom CSV deck and shuffles it onto draw", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: {
            name: "Custom",
            cardset: "custom-csv",
            customlist: "Ace, King, Queen",
          },
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.decks).toHaveLength(1);
        expect(saved.decks[0].name).toBe("Custom");
        expect(saved.decks[0].allCards.map((card) => card.name).sort()).toEqual([
          "Ace",
          "King",
          "Queen",
        ]);
        expect(saved.decks[0].piles.draw.cards).toHaveLength(3);
        expect(harness.lastContent()).toContain("Added and shuffled the new deck: Custom");
      }
    );
  });

  test("deck new refuses a duplicate deck name", async () => {
    await withHarness(
      {
        gameData: gameWithDeck(),
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: { name: "Main", cardset: "customempty" },
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toContain("already a deck with that name");
        expect((await harness.getSavedGame()).decks).toHaveLength(1);
      }
    );
  });

  test("deck new refuses to attach a deck when no game exists", async () => {
    await withHarness(
      {
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: { name: "Main", cardset: "customempty" },
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toContain("use \"/game newgame\"");
      }
    );
  });

  test("deck new autocomplete lists enabled catalog templates plus custom-csv", async () => {
    await withHarness(
      {
        isAutocomplete: true,
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: { cardset: "alpha" },
        },
      },
      async (harness) => {
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.insertTemplate({
          id: "alpha-set",
          name: "Alpha Set",
          cards: [{ name: "Ace", description: "", type: "", suit: "", value: "", url: null, format: "A" }],
        });
        catalog.insertTemplate({
          id: "zeta-disabled",
          name: "Zeta Disabled",
          cards: [{ name: "Hidden", description: "", type: "", suit: "", value: "", url: null, format: "A" }],
          enabled: 0,
        });
        catalog.close();

        await runCards(harness);
        const choices = harness.calls.respond[0];
        expect(choices).toEqual([{ name: "Alpha Set", value: "alpha-set" }]);
        expect(choices.some((choice) => choice.value === "zeta-disabled")).toBe(
          false
        );
      }
    );
  });

  test("deck new materializes an enabled catalog template with new ids", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: { name: "Table", cardset: "alpha-set" },
        },
      },
      async (harness) => {
        const stored = [
          {
            id: "stored-ace",
            origin: "alpha-set",
            name: "Ace",
            description: "",
            type: "",
            suit: "",
            value: "",
            url: null,
            format: "A",
          },
          {
            name: "King",
            description: "",
            type: "",
            suit: "",
            value: "",
            url: null,
            format: "B",
          },
        ];
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.insertTemplate({
          id: "alpha-set",
          name: "Alpha Set",
          cards: stored,
        });
        catalog.close();

        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.decks).toHaveLength(1);
        expect(saved.decks[0].allCards.map((card) => card.name)).toEqual([
          "Ace",
          "King",
        ]);
        expect(saved.decks[0].allCards[0].id).not.toBe("stored-ace");
        expect(saved.decks[0].allCards.every((card) => card.origin === "Table")).toBe(
          true
        );
        expect(harness.lastContent()).toContain("Added and shuffled the new deck: Table");
      }
    );
  });

  test("deck new materializes standard from a seeded catalog as 52 cards", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: { name: "Poker", cardset: "standard" },
        },
      },
      async (harness) => {
        seedDeckCatalog();
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.decks[0].allCards).toHaveLength(52);
        expect(
          saved.decks[0].allCards.every((card) => card.origin === "Poker")
        ).toBe(true);
        const ids = saved.decks[0].allCards.map((card) => card.id);
        expect(new Set(ids).size).toBe(52);
      }
    );
  });

  test("deck new rejects a disabled or unknown catalog set", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: { name: "Nope", cardset: "zeta-disabled" },
        },
      },
      async (harness) => {
        const catalog = new DeckCatalog({ dataDir: harness.dataDir });
        catalog.insertTemplate({
          id: "zeta-disabled",
          name: "Zeta Disabled",
          cards: [{ name: "Hidden", description: "", type: "", suit: "", value: "", url: null, format: "A" }],
          enabled: 0,
        });
        catalog.close();

        await runCards(harness);
        expect(harness.lastContent()).toBe("unknown or disabled card set");
        expect((await harness.getSavedGame()).decks).toHaveLength(0);
      }
    );
  });

  test("deck draw moves the top card into the caller's hand", async () => {
    const top = createCard({ id: "top", name: "Queen", origin: "Main" });
    const next = createCard({ id: "next", name: "King", origin: "Main" });
    await withHarness(
      {
        gameData: gameWithDeck({ draw: [top, next] }),
        options: {
          subcommandGroup: "deck",
          subcommand: "draw",
          strings: { deck: "Main" },
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.decks[0].piles.draw.cards.map((card) => card.id)).toEqual(["next"]);
        expect(saved.players[0].hands.main.map((card) => card.id)).toEqual(["top"]);
        expect(harness.lastContent()).toContain("drew a card from Main");
        expect(harness.calls.followUp[0].content).toBe("You drew:");
        expect(saved.history.at(-1).action.type).toBe("draw");
      }
    );
  });

  test("deck draw reports an empty draw pile", async () => {
    await withHarness(
      {
        gameData: gameWithDeck({ draw: [] }),
        options: {
          subcommandGroup: "deck",
          subcommand: "draw",
          strings: { deck: "Main" },
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toBe("No cards in draw pile");
      }
    );
  });

  test("deck shuffle moves discard cards back to the draw pile", async () => {
    const discarded = [
      createCard({ id: "d1", name: "Two", origin: "Main" }),
      createCard({ id: "d2", name: "Three", origin: "Main" }),
    ];
    await withHarness(
      {
        gameData: gameWithDeck({
          draw: [createCard({ id: "keep", name: "Ace", origin: "Main" })],
          discard: discarded,
        }),
        options: {
          subcommandGroup: "deck",
          subcommand: "shuffle",
          strings: { deck: "Main" },
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.decks[0].piles.discard.cards).toHaveLength(0);
        expect(saved.decks[0].piles.draw.cards).toHaveLength(3);
        expect(
          saved.decks[0].piles.draw.cards.map((card) => card.id).sort()
        ).toEqual(["d1", "d2", "keep"]);
        expect(harness.lastContent()).toContain("Shuffled Main");
      }
    );
  });

  test("hand play sends a card to the discard pile", async () => {
    const card = createCard({ id: "play-1", name: "Ace", origin: "Main" });
    await withHarness(
      {
        gameData: gameWithDeck({ draw: [], hand: [card] }),
        options: {
          subcommandGroup: "hand",
          subcommand: "play",
          strings: { card: "play-1", destination: "discard" },
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.players[0].hands.main).toHaveLength(0);
        expect(saved.decks[0].piles.discard.cards.map((item) => item.id)).toEqual([
          "play-1",
        ]);
        expect(harness.lastContent()).toContain("Played to discard pile");
      }
    );
  });

  test("hand play can target the player's play area", async () => {
    const card = createCard({ id: "play-2", name: "King", origin: "Main" });
    await withHarness(
      {
        gameData: gameWithDeck({ draw: [], hand: [card] }),
        options: {
          subcommandGroup: "hand",
          subcommand: "play",
          strings: { card: "play-2", destination: "playarea" },
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.players[0].playArea.map((item) => item.id)).toEqual(["play-2"]);
        expect(saved.players[0].hands.main).toHaveLength(0);
        expect(harness.lastContent()).toContain("Played to play area");
      }
    );
  });

  test("pile create adds a named global pile", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: {
          subcommandGroup: "pile",
          subcommand: "create",
          strings: { name: "Market" },
          booleans: { secret: false },
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.globalPiles).toHaveLength(1);
        expect(saved.globalPiles[0]).toMatchObject({
          name: "Market",
          isSecret: false,
          cards: [],
        });
        expect(harness.lastContent()).toContain("created a new pile: **Market**");
      }
    );
  });

  test("hand play autocomplete uses getFocused for the card option", async () => {
    const ace = createCard({ id: "ace-1", name: "Ace", origin: "Main" });
    const king = createCard({ id: "king-1", name: "King", origin: "Main" });
    await withHarness(
      {
        isAutocomplete: true,
        gameData: gameWithDeck({ draw: [], hand: [ace, king] }),
        options: {
          subcommandGroup: "hand",
          subcommand: "play",
          focused: "ace",
          focusedName: "card",
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.calls.respond[0]).toEqual([
          { name: "Ace", value: "ace-1" },
        ]);
      }
    );
  });

  test("deck draw persists through GameStore SQLite in the temp data dir", async () => {
    const top = createCard({ id: "top", name: "Queen", origin: "Main" });
    await withHarness(
      {
        useGameStore: true,
        gameData: gameWithDeck({ draw: [top] }),
        options: {
          subcommandGroup: "deck",
          subcommand: "draw",
          strings: { deck: "Main" },
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.players[0].hands.main.map((card) => card.id)).toEqual(["top"]);
        expect(saved.decks[0].piles.draw.cards).toHaveLength(0);
      }
    );
  });

  test("pile create rejects a duplicate pile name", async () => {
    await withHarness(
      {
        gameData: createActiveGame({
          globalPiles: [
            { id: "pile-1", name: "Market", cards: [], isSecret: false },
          ],
        }),
        options: {
          subcommandGroup: "pile",
          subcommand: "create",
          strings: { name: "Market" },
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toContain('A pile named "Market" already exists');
        expect((await harness.getSavedGame()).globalPiles).toHaveLength(1);
      }
    );
  });
});
