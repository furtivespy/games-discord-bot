const { describe, expect, test } = require("bun:test");
const Cards = require("../slashcommands/genericgame/cards");
const GameBoardClear = require("../subcommands/cards/gameboardclear");
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

function gameWithBoard(cards, overrides = {}) {
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
    ...overrides,
  });
}

const clearOptions = {
  subcommandGroup: "gameboard",
  subcommand: "clear",
};

function resetInteractionForFollowUp(harness, { subcommandGroup, subcommand }) {
  harness.interaction.deferred = false;
  harness.interaction.replied = false;
  harness.interaction.options.getSubcommandGroup = () => subcommandGroup;
  harness.interaction.options.getSubcommand = () => subcommand;
}

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
        expect(harness.interaction.deferred).toBe(true);
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

  test("status persist failure still resolves the deferred reply so a later command can defer", async () => {
    const originalError = console.error;
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
          const originalSet = harness.client.setGameDataV2.bind(harness.client);
          let saves = 0;
          harness.client.setGameDataV2 = async (...args) => {
            saves += 1;
            if (saves > 1) {
              throw new Error("db locked");
            }
            return originalSet(...args);
          };

          await runCards(harness);

          expect(harness.interaction.deferred).toBe(true);
          expect(harness.interaction.replied).toBe(true);
          expect(harness.lastContent()).toContain("cleared the Game Board (1 card moved to discard piles)");

          const saved = await harness.getSavedGame();
          expect(saved.gameBoard).toEqual([]);
          expect(saved.decks[0].piles.discard.cards).toHaveLength(1);

          resetInteractionForFollowUp(harness, {
            subcommandGroup: "gameboard",
            subcommand: "view",
          });
          await runCards(harness);
          expect(harness.calls.deferReply.length).toBeGreaterThanOrEqual(2);
          expect(harness.interaction.replied).toBe(true);
          expect(harness.lastContent()).toContain("The Game Board is empty");
        }
      );
    } finally {
      console.error = originalError;
    }
  });

  test("editReply failure during status update still falls back to a content-only ACK", async () => {
    const originalError = console.error;
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
          const originalEdit = harness.interaction.editReply.bind(harness.interaction);
          let edits = 0;
          harness.interaction.editReply = async (payload) => {
            edits += 1;
            if (edits === 1) {
              const error = new Error("Unknown interaction");
              error.code = 10062;
              throw error;
            }
            return originalEdit(payload);
          };

          await runCards(harness);

          expect(edits).toBe(2);
          expect(harness.interaction.replied).toBe(true);
          expect(harness.lastContent()).toContain("cleared the Game Board (1 card moved to discard piles)");
          expect((await harness.getSavedGame()).gameBoard).toEqual([]);
        }
      );
    } finally {
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

        resetInteractionForFollowUp(harness, {
          subcommandGroup: "gameboard",
          subcommand: "view",
        });
        await runCards(harness);

        expect(harness.calls.deferReply.length).toBeGreaterThanOrEqual(2);
        expect(harness.lastContent()).toContain("The Game Board is empty");
        expect(harness.interaction.replied).toBe(true);
      }
    );
  });

  test("leaves origin-less cards on the board and does not claim they were discarded", async () => {
    const orphan = createCard({ id: "orphan", name: "Orphan", origin: "MissingDeck" });
    await withHarness(
      {
        gameData: gameWithBoard([orphan]),
        options: clearOptions,
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.interaction.replied).toBe(true);
        expect(harness.lastContent()).toContain("Could not move Game Board cards to discard piles");
        expect(harness.lastContent()).not.toContain("moved to discard piles");
        const saved = await harness.getSavedGame();
        expect(saved.gameBoard.map((card) => card.id)).toEqual(["orphan"]);
        expect(saved.decks[0].piles.discard.cards).toHaveLength(0);
        expect(harness.persistCalls).toHaveLength(0);
      }
    );
  });

  test("discards movable cards and keeps cards whose origin deck is missing", async () => {
    await withHarness(
      {
        gameData: gameWithBoard([
          createCard({ id: "ace", name: "Ace", origin: "Main" }),
          createCard({ id: "orphan", name: "Orphan", origin: "MissingDeck" }),
        ]),
        options: clearOptions,
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toContain("1 card moved to discard piles");
        expect(harness.lastContent()).not.toContain("2 card");
        const saved = await harness.getSavedGame();
        expect(saved.gameBoard.map((card) => card.id)).toEqual(["orphan"]);
        expect(saved.decks[0].piles.discard.cards.map((card) => card.id)).toEqual(["ace"]);
      }
    );
  });

  test("resolves the slash reply before posting a pinned status message", async () => {
    await withHarness(
      {
        gameData: gameWithBoard(
          [createCard({ id: "ace", name: "Ace", origin: "Main" })],
          { pinnedStatusMode: "on", pinnedStatusEnabled: true }
        ),
        options: clearOptions,
      },
      async (harness) => {
        const order = [];
        const originalEdit = harness.interaction.editReply.bind(harness.interaction);
        harness.interaction.editReply = async (payload) => {
          order.push("editReply");
          return originalEdit(payload);
        };
        const originalSend = harness.channel.send.bind(harness.channel);
        harness.channel.send = async (payload) => {
          order.push("send");
          return originalSend(payload);
        };

        await runCards(harness);

        expect(order[0]).toBe("editReply");
        expect(harness.interaction.replied).toBe(true);
        expect(order).toContain("send");
        expect(harness.lastContent()).toContain("cleared the Game Board");
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
