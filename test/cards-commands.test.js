const { describe, expect, test } = require("bun:test");
const { MessageFlags } = require("discord.js");
const Cards = require("../slashcommands/genericgame/cards");
const DeckCatalog = require("../db/deckCatalog.js");
const { seedDeckCatalog } = require("../db/seedDeckCatalog.js");
const Formatter = require("../modules/GameFormatter");
const GameHelper = require("../modules/GlobalGameHelper");
const {
  collectedReplyText,
  createActiveGame,
  createCard,
  createDeck,
  createPlayer,
  withHarness,
} = require("./helpers/harness");

function emptyCardsetChoice(choices) {
  return choices.find((choice) => choice.value === "empty");
}

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

function gameWithTwoDecks({
  first = { draw: [createCard({ id: "m1", name: "Ace", origin: "Main" })] },
  second = { draw: [createCard({ id: "r1", name: "King", origin: "Reserve" })] },
} = {}) {
  return createActiveGame({
    players: [
      createPlayer({
        userId: "user-1",
        name: "Alice",
        order: 0,
        hands: {
          main: [],
          played: [],
          passed: [],
          received: [],
          simultaneous: [],
        },
      }),
      createPlayer({ userId: "user-2", name: "Bob", order: 1 }),
    ],
    decks: [
      createDeck({ name: "Main", ...first }),
      createDeck({ name: "Reserve", ...second }),
    ],
  });
}

const MULTI_DECK_OMIT_COMMANDS = [
  { name: "deck draw", options: { subcommandGroup: "deck", subcommand: "draw" } },
  {
    name: "deck drawmultiple",
    options: { subcommandGroup: "deck", subcommand: "drawmultiple", integers: { count: 2 } },
  },
  { name: "deck shuffle", options: { subcommandGroup: "deck", subcommand: "shuffle" } },
  { name: "deck flipcard", options: { subcommandGroup: "deck", subcommand: "flipcard" } },
  {
    name: "deck flipmultiple",
    options: { subcommandGroup: "deck", subcommand: "flipmultiple", integers: { count: 1 } },
  },
  { name: "deck peek", options: { subcommandGroup: "deck", subcommand: "peek" } },
  {
    name: "deck deal",
    options: { subcommandGroup: "deck", subcommand: "deal", integers: { count: 1 } },
  },
  { name: "deck recall", options: { subcommandGroup: "deck", subcommand: "recall" } },
  { name: "deck review", options: { subcommandGroup: "deck", subcommand: "review" } },
  { name: "deck check", options: { subcommandGroup: "deck", subcommand: "check" } },
  { name: "deck pick", options: { subcommandGroup: "deck", subcommand: "pick" } },
  {
    name: "deck burn",
    options: { subcommandGroup: "deck", subcommand: "burn", integers: { count: 1 } },
  },
  { name: "deck prune", options: { subcommandGroup: "deck", subcommand: "prune" } },
  {
    name: "deck addcard",
    options: { subcommandGroup: "deck", subcommand: "addcard", strings: { name: "Promo" } },
  },
  {
    name: "deck addlist",
    options: { subcommandGroup: "deck", subcommand: "addlist", strings: { customlist: "A, B" } },
  },
  {
    name: "deck configure",
    options: {
      subcommandGroup: "deck",
      subcommand: "configure",
      strings: { config: "shufflestyle" },
    },
  },
  {
    name: "draft deal",
    options: { subcommandGroup: "draft", subcommand: "deal", integers: { count: 1 } },
  },
];

describe("cardset autocomplete", () => {
  test("unfiltered list pins empty near the top and keeps the name starting with empty", () => {
    const choices = GameHelper.getCardLists("");
    expect(choices.length).toBeLessThanOrEqual(25);
    const emptyChoice = emptyCardsetChoice(choices);
    expect(emptyChoice).toEqual({ name: "empty (start from scratch)", value: "empty" });
    expect(choices.findIndex((choice) => choice.value === "empty")).toBeLessThan(3);
    expect(emptyChoice.name.startsWith("empty")).toBe(true);
  });

  test("typing empty or Empty keeps a prefix-matching empty choice", () => {
    const lower = emptyCardsetChoice(GameHelper.getCardLists("empty"));
    expect(lower).toBeDefined();
    expect(lower.name.startsWith("empty")).toBe(true);

    const mixed = emptyCardsetChoice(GameHelper.getCardLists("Empty"));
    expect(mixed).toBeDefined();
    expect(mixed.name.startsWith("Empty")).toBe(true);
    expect(mixed.name.toLowerCase()).toContain("start from scratch");
  });

  test("id match still finds empty when the display name would not prefix-match the query", () => {
    const byId = emptyCardsetChoice(GameHelper.getCardLists("empty"));
    expect(byId?.value).toBe("empty");
  });
});

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

  test("help documents view, show, and showall instead of reveal", async () => {
    await withHarness(
      { options: { subcommand: "help" } },
      async (harness) => {
        await runCards(harness);
        const helpText = collectedReplyText(harness);
        expect(helpText).toContain("/cards hand view");
        expect(helpText).toContain("/cards hand show");
        expect(helpText).toContain("/cards hand showall");
        expect(helpText).not.toContain("/cards hand reveal");
      }
    );
  });

  test("hand group exposes view, show, and showall instead of reveal", () => {
    const command = new Cards({});
    const json = command.data.toJSON();
    const hand = json.options.find((option) => option.name === "hand");
    const names = hand.options.map((option) => option.name);
    expect(names).toEqual(expect.arrayContaining(["view", "show", "showall"]));
    expect(names).not.toContain("reveal");
    const show = hand.options.find((option) => option.name === "show");
    expect(show.options.some((option) => option.name === "card" && option.required)).toBe(true);
    expect(hand.options.find((option) => option.name === "view").options || []).toHaveLength(0);
    expect(hand.options.find((option) => option.name === "showall").options || []).toHaveLength(0);
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

  test("deck new creates an empty deck from cardset empty", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: { name: "Scratch", cardset: "empty" },
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.decks).toHaveLength(1);
        expect(saved.decks[0].name).toBe("Scratch");
        expect(saved.decks[0].allCards).toEqual([]);
        expect(saved.decks[0].piles.draw.cards).toEqual([]);
        expect(saved.decks[0].piles.discard.cards).toEqual([]);
        expect(harness.lastContent()).toContain("Added and shuffled the new deck: Scratch");
      }
    );
  });

  test("deck new still accepts customempty as an empty starting deck", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: { name: "Blank", cardset: "customempty" },
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.decks[0].allCards).toEqual([]);
        expect(saved.decks[0].piles.draw.cards).toEqual([]);
      }
    );
  });

  test("deck new unfiltered autocomplete includes empty as a cardset", async () => {
    await withHarness(
      {
        isAutocomplete: true,
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: { cardset: "" },
          focused: "",
          focusedName: "cardset",
        },
      },
      async (harness) => {
        await runCards(harness);
        const choices = harness.calls.respond[0];
        expect(choices.length).toBeLessThanOrEqual(25);
        expect(choices).toEqual(
          expect.arrayContaining([{ name: "empty (start from scratch)", value: "empty" }])
        );
        expect(choices.find((choice) => choice.value === "empty")?.name.toLowerCase().startsWith("empty")).toBe(true);
      }
    );
  });

  test("deck new autocomplete shows empty when the user types empty", async () => {
    await withHarness(
      {
        isAutocomplete: true,
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          strings: { cardset: "empty" },
          focused: "empty",
          focusedName: "cardset",
        },
      },
      async (harness) => {
        await runCards(harness);
        const choices = harness.calls.respond[0];
        const emptyChoice = choices.find((choice) => choice.value === "empty");
        expect(emptyChoice).toBeDefined();
        expect(emptyChoice.name.startsWith("empty")).toBe(true);
        expect(emptyChoice.name.toLowerCase()).toContain("start from scratch");
      }
    );
  });

  test("deck new autocomplete keeps empty visible when the user types Empty", async () => {
    await withHarness(
      {
        isAutocomplete: true,
        options: {
          subcommandGroup: "deck",
          subcommand: "new",
          focused: "Empty",
          focusedName: "cardset",
        },
      },
      async (harness) => {
        await runCards(harness);
        const emptyChoice = harness.calls.respond[0].find((choice) => choice.value === "empty");
        expect(emptyChoice).toBeDefined();
        expect(emptyChoice.name.startsWith("Empty")).toBe(true);
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
        expect(choices).toEqual([{ name: "alpha Set", value: "alpha-set" }]);
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

  test("deck draw with one deck and no deck option uses that deck", async () => {
    const top = createCard({ id: "top", name: "Queen", origin: "Main" });
    await withHarness(
      {
        gameData: gameWithDeck({ draw: [top] }),
        options: {
          subcommandGroup: "deck",
          subcommand: "draw",
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.players[0].hands.main.map((card) => card.id)).toEqual(["top"]);
        expect(harness.lastContent()).toContain("drew a card from Main");
      }
    );
  });

  test("deck draw with several decks and no deck option asks to specify a deck", async () => {
    await withHarness(
      {
        gameData: gameWithTwoDecks(),
        options: {
          subcommandGroup: "deck",
          subcommand: "draw",
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toBe(GameHelper.SPECIFY_DECK_MESSAGE);
        expect(harness.lastContent()).not.toBe("No cards in draw pile");
        expect(harness.persistCalls).toHaveLength(0);
      }
    );
  });

  test("deck draw with several decks still reports an empty named deck", async () => {
    await withHarness(
      {
        gameData: gameWithTwoDecks({
          first: { draw: [] },
        }),
        options: {
          subcommandGroup: "deck",
          subcommand: "draw",
          strings: { deck: "Main" },
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toBe("No cards in draw pile");
        expect(harness.persistCalls).toHaveLength(0);
      }
    );
  });

  test("deck draw does not silently use a player-owned deck when several decks exist", async () => {
    const playerDeck = createDeck({
      name: "Alice",
      draw: [createCard({ id: "p1", name: "Copper", origin: "Alice" })],
    });
    playerDeck.id = "user-1";
    await withHarness(
      {
        gameData: createActiveGame({
          players: [createPlayer({ userId: "user-1", name: "Alice", order: 0 })],
          decks: [
            playerDeck,
            createDeck({
              name: "Supply",
              draw: [createCard({ id: "s1", name: "Gold", origin: "Supply" })],
            }),
          ],
        }),
        options: {
          subcommandGroup: "deck",
          subcommand: "draw",
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toBe(GameHelper.SPECIFY_DECK_MESSAGE);
        expect(harness.persistCalls).toHaveLength(0);
      }
    );
  });

  test("deck shuffle with one deck and no deck option shuffles that deck", async () => {
    const discarded = [createCard({ id: "d1", name: "Two", origin: "Main" })];
    await withHarness(
      {
        gameData: gameWithDeck({
          draw: [createCard({ id: "keep", name: "Ace", origin: "Main" })],
          discard: discarded,
        }),
        options: {
          subcommandGroup: "deck",
          subcommand: "shuffle",
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.decks[0].piles.discard.cards).toHaveLength(0);
        expect(saved.decks[0].piles.draw.cards).toHaveLength(2);
        expect(harness.lastContent()).toContain("Shuffled Main");
      }
    );
  });

  test("deck shuffle with an empty named deck still says there is no deck to shuffle", async () => {
    await withHarness(
      {
        gameData: gameWithTwoDecks({
          first: { draw: [], discard: [] },
        }),
        options: {
          subcommandGroup: "deck",
          subcommand: "shuffle",
          strings: { deck: "Main" },
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toBe("No Deck to shuffle.");
        expect(harness.persistCalls).toHaveLength(0);
      }
    );
  });

  test("deck deal with an empty named deck still says there are no cards to deal", async () => {
    await withHarness(
      {
        gameData: gameWithTwoDecks({
          first: { draw: [], discard: [] },
        }),
        options: {
          subcommandGroup: "deck",
          subcommand: "deal",
          integers: { count: 1 },
          strings: { deck: "Main" },
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toBe("No cards to deal.");
        expect(harness.persistCalls).toHaveLength(0);
      }
    );
  });

  test("deck prune with an empty named deck still says there are no cards to prune", async () => {
    await withHarness(
      {
        gameData: gameWithTwoDecks({
          first: { draw: [] },
        }),
        options: {
          subcommandGroup: "deck",
          subcommand: "prune",
          strings: { deck: "Main" },
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toBe("This deck has no cards to prune.");
        expect(harness.persistCalls).toHaveLength(0);
      }
    );
  });

  test("deck addcard with one deck and no deck option adds to that deck", async () => {
    await withHarness(
      {
        gameData: gameWithDeck({ draw: [createCard({ id: "ace", name: "Ace", origin: "Main" })] }),
        options: {
          subcommandGroup: "deck",
          subcommand: "addcard",
          strings: { name: "Promo" },
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.decks[0].allCards.map((card) => card.name)).toContain("Promo");
        expect(harness.lastContent()).toContain("added");
        expect(harness.lastContent()).toContain("Main");
      }
    );
  });

  for (const command of MULTI_DECK_OMIT_COMMANDS) {
    test(`${command.name} with several decks and no deck option asks to specify a deck`, async () => {
      await withHarness(
        {
          gameData: gameWithTwoDecks(),
          options: command.options,
        },
        async (harness) => {
          await runCards(harness);
          expect(harness.lastContent()).toBe(GameHelper.SPECIFY_DECK_MESSAGE);
          expect(harness.lastContent()).not.toBe("No cards in draw pile");
          expect(harness.lastContent()).not.toBe("No cards to deal.");
          expect(harness.lastContent()).not.toBe("No Deck to shuffle.");
          expect(harness.lastContent()).not.toBe("This deck has no cards to prune.");
          expect(harness.lastContent()).not.toBe("No cards to pick up");
          expect(harness.persistCalls).toHaveLength(0);
        }
      );
    });
  }

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

  test("hand view privately displays the caller's hand without changing cards", async () => {
    const ace = createCard({ id: "ace-1", name: "Ace", origin: "Main" });
    await withHarness(
      {
        gameData: gameWithDeck({ draw: [], hand: [ace] }),
        options: {
          subcommandGroup: "hand",
          subcommand: "view",
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.calls.deferReply[0].flags).toBe(MessageFlags.Ephemeral);
        expect(harness.persistCalls).toHaveLength(0);
        expect((await harness.getSavedGame()).players[0].hands.main.map((card) => card.id)).toEqual([
          "ace-1",
        ]);
      }
    );
  });

  test("hand show publicly reveals one card without removing it from hand", async () => {
    const ace = createCard({ id: "ace-1", name: "Ace", origin: "Main" });
    const king = createCard({ id: "king-1", name: "King", origin: "Main" });
    await withHarness(
      {
        gameData: gameWithDeck({ draw: [], hand: [ace, king] }),
        options: {
          subcommandGroup: "hand",
          subcommand: "show",
          strings: { card: "ace-1" },
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.players[0].hands.main.map((card) => card.id)).toEqual(["ace-1", "king-1"]);
        expect(harness.calls.deferReply[0].flags).toBeUndefined();
        expect(harness.lastContent()).toContain("Showing a card");
        expect(saved.history.at(-1).action.type).toBe("reveal");
        expect(saved.history.at(-1).summary).toContain("Ace");
        expect(harness.calls.followUp[0].flags).toBe(MessageFlags.Ephemeral);
      }
    );
  });

  test("hand show attaches the card image when the card has a url", async () => {
    const originalFetch = Formatter.fetchCardImageBuffer;
    Formatter.fetchCardImageBuffer = async (url) => {
      expect(url).toBe("https://cards.example/ace.jpg");
      return Buffer.from("fake-jpg");
    };
    try {
      const ace = createCard({
        id: "ace-1",
        name: "Ace",
        origin: "Main",
        url: "https://cards.example/ace.jpg",
      });
      await withHarness(
        {
          gameData: gameWithDeck({ draw: [], hand: [ace] }),
          options: {
            subcommandGroup: "hand",
            subcommand: "show",
            strings: { card: "ace-1" },
          },
        },
        async (harness) => {
          await runCards(harness);
          const reply = harness.calls.editReply[0];
          expect(reply.files).toHaveLength(1);
          expect(reply.files[0].name).toBe("played-card-ace-1.jpg");
          expect(reply.embeds[0].data.image.url).toBe("attachment://played-card-ace-1.jpg");
        }
      );
    } finally {
      Formatter.fetchCardImageBuffer = originalFetch;
    }
  });

  test("hand show autocomplete uses getFocused for the card option", async () => {
    const ace = createCard({ id: "ace-1", name: "Ace", origin: "Main" });
    const king = createCard({ id: "king-1", name: "King", origin: "Main" });
    await withHarness(
      {
        isAutocomplete: true,
        gameData: gameWithDeck({ draw: [], hand: [ace, king] }),
        options: {
          subcommandGroup: "hand",
          subcommand: "show",
          focused: "ace",
          focusedName: "card",
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.calls.respond[0]).toEqual([{ name: "Ace", value: "ace-1" }]);
      }
    );
  });

  test("hand showall publicly reveals every card without removing them from hand", async () => {
    const ace = createCard({ id: "ace-1", name: "Ace", origin: "Main" });
    const king = createCard({ id: "king-1", name: "King", origin: "Main" });
    await withHarness(
      {
        gameData: gameWithDeck({ draw: [], hand: [ace, king] }),
        options: {
          subcommandGroup: "hand",
          subcommand: "showall",
        },
      },
      async (harness) => {
        await runCards(harness);
        const saved = await harness.getSavedGame();
        expect(saved.players[0].hands.main.map((card) => card.id)).toEqual(["ace-1", "king-1"]);
        expect(harness.calls.deferReply[0].flags).toBeUndefined();
        expect(harness.lastContent()).toContain("Showing all cards in hand");
        expect(harness.calls.editReply[0].embeds[0].title).toContain("hand");
        expect(saved.history.at(-1).action.type).toBe("reveal");
        expect(saved.history.at(-1).summary).toContain("all 2 cards");
        expect(harness.calls.followUp[0].flags).toBe(MessageFlags.Ephemeral);
      }
    );
  });

  test("hand showall reports an empty hand", async () => {
    await withHarness(
      {
        gameData: gameWithDeck({ draw: [], hand: [] }),
        options: {
          subcommandGroup: "hand",
          subcommand: "showall",
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toBe("You have no cards in your hand to show.");
        expect(harness.persistCalls).toHaveLength(0);
      }
    );
  });

  test("hand reveal is no longer a command", async () => {
    await withHarness(
      {
        gameData: gameWithDeck(),
        options: {
          subcommandGroup: "hand",
          subcommand: "reveal",
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toContain("Command not fully written yet");
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
