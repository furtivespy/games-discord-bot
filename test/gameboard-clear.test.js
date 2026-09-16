const { describe, expect, test } = require("bun:test");
const Cards = require("../slashcommands/genericgame/cards");
const GameBoardClear = require("../subcommands/cards/gameboardclear");
const GameStatusHelper = require("../modules/GameStatusHelper");
const {
  createActiveGame,
  createCard,
  createDeck,
  createMember,
  createPlayer,
  createUser,
  withHarness,
} = require("./helpers/harness");

async function runCards(harness) {
  const command = new Cards(harness.client);
  await command.execute(harness.interaction);
}

function gameWithBoard(cards) {
  return createActiveGame({
    players: [
      createPlayer({ userId: "user-1", name: "Forest", order: 0 }),
      createPlayer({ userId: "user-2", name: "Bob", order: 1 }),
    ],
    decks: [
      createDeck({
        name: "Main",
        draw: [],
        discard: [],
      }),
    ],
    gameBoard: cards,
  });
}

const clearOptions = {
  subcommandGroup: "gameboard",
  subcommand: "clear",
};

describe("/cards gameboard clear", () => {
  test("moves board cards to discard and resolves the deferred slash reply", async () => {
    const boardCard = createCard({ id: "ace", name: "Ace", origin: "Main" });
    await withHarness(
      {
        gameData: gameWithBoard([boardCard]),
        user: createUser({ id: "user-1", username: "Forest" }),
        member: createMember({ id: "user-1", username: "Forest", displayName: "Forest" }),
        options: clearOptions,
      },
      async (harness) => {
        await runCards(harness);

        expect(harness.calls.deferReply).toHaveLength(1);
        expect(harness.interaction.replied).toBe(true);
        expect(harness.lastContent()).toContain("Forest cleared the Game Board (1 card moved to discard piles)");
        expect(harness.lastContent()).not.toContain("1 cards");

        const successSends = harness.sendCalls.filter(
          (payload) =>
            typeof payload.content === "string" &&
            payload.content.includes("cleared the Game Board")
        );
        expect(successSends).toHaveLength(0);

        const saved = await harness.getSavedGame();
        expect(saved.gameBoard).toEqual([]);
        expect(saved.decks[0].piles.discard.cards.map((card) => card.id)).toEqual(["ace"]);
      }
    );
  });

  test("pluralizes the success message for more than one card", async () => {
    await withHarness(
      {
        gameData: gameWithBoard([
          createCard({ id: "ace", name: "Ace", origin: "Main" }),
          createCard({ id: "king", name: "King", origin: "Main" }),
        ]),
        options: clearOptions,
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toContain("2 cards moved to discard piles");
        expect((await harness.getSavedGame()).decks[0].piles.discard.cards).toHaveLength(2);
      }
    );
  });

  test("empty board still resolves the deferred reply and does not persist", async () => {
    await withHarness(
      {
        gameData: gameWithBoard([]),
        options: clearOptions,
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.calls.deferReply).toHaveLength(1);
        expect(harness.interaction.replied).toBe(true);
        expect(harness.lastContent()).toContain("The Game Board is already empty");
        expect(harness.persistCalls).toHaveLength(0);
      }
    );
  });

  test("missing game still resolves the deferred reply", async () => {
    await withHarness(
      {
        options: clearOptions,
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.calls.deferReply).toHaveLength(1);
        expect(harness.interaction.replied).toBe(true);
        expect(harness.lastContent()).toContain("There is no game in this channel");
      }
    );
  });

  test("status-update failure still resolves the deferred reply so later commands work", async () => {
    const originalSend = GameStatusHelper.sendPublicStatusUpdate;
    const originalError = console.error;
    GameStatusHelper.sendPublicStatusUpdate = async () => {
      throw new Error("status render hung");
    };
    console.error = () => {};

    try {
      await withHarness(
        {
          gameData: gameWithBoard([
            createCard({ id: "ace", name: "Ace", origin: "Main" }),
          ]),
          options: clearOptions,
        },
        async (harness) => {
          await runCards(harness);

          expect(harness.interaction.replied).toBe(true);
          expect(harness.lastContent()).toContain("cleared the Game Board (1 card moved to discard piles)");

          const saved = await harness.getSavedGame();
          expect(saved.gameBoard).toEqual([]);
          expect(saved.decks[0].piles.discard.cards).toHaveLength(1);

          harness.interaction.options.getSubcommandGroup = () => "gameboard";
          harness.interaction.options.getSubcommand = () => "view";
          await runCards(harness);
          expect(harness.lastContent()).toContain("The Game Board is empty");
        }
      );
    } finally {
      GameStatusHelper.sendPublicStatusUpdate = originalSend;
      console.error = originalError;
    }
  });

  test("a follow-up command still works after a successful clear", async () => {
    await withHarness(
      {
        gameData: gameWithBoard([
          createCard({ id: "ace", name: "Ace", origin: "Main" }),
        ]),
        options: clearOptions,
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.interaction.replied).toBe(true);

        harness.interaction.deferred = false;
        harness.interaction.replied = false;
        harness.interaction.options.getSubcommandGroup = () => "gameboard";
        harness.interaction.options.getSubcommand = () => "view";
        await runCards(harness);

        expect(harness.lastContent()).toContain("The Game Board is empty");
        expect(harness.interaction.replied).toBe(true);
      }
    );
  });

  test("drops origin-less cards without hanging and still resolves the reply", async () => {
    await withHarness(
      {
        gameData: gameWithBoard([
          createCard({ id: "orphan", name: "Orphan", origin: "MissingDeck" }),
        ]),
        options: clearOptions,
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.interaction.replied).toBe(true);
        const saved = await harness.getSavedGame();
        expect(saved.gameBoard).toEqual([]);
        expect(saved.decks[0].piles.discard.cards).toHaveLength(0);
      }
    );
  });

  test("direct execute still defers before mutating so Discord can ACK", async () => {
    const boardCard = createCard({ id: "ace", name: "Ace", origin: "Main" });
    await withHarness(
      {
        gameData: gameWithBoard([boardCard]),
        options: clearOptions,
      },
      async (harness) => {
        const order = [];
        const originalDefer = harness.interaction.deferReply.bind(harness.interaction);
        harness.interaction.deferReply = async (...args) => {
          order.push("defer");
          return originalDefer(...args);
        };
        const originalGet = harness.client.getGameDataV2.bind(harness.client);
        harness.client.getGameDataV2 = async (...args) => {
          order.push("load");
          return originalGet(...args);
        };

        await GameBoardClear.execute(harness.interaction, harness.client);
        expect(order[0]).toBe("defer");
        expect(order).toContain("load");
        expect(harness.interaction.replied).toBe(true);
      }
    );
  });
});
