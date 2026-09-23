const { describe, expect, test } = require("bun:test");
const Players = require("../slashcommands/players/players");
const Cards = require("../slashcommands/genericgame/cards");
const modalSubmission = require("../events/modalSubmission");
const {
  createActiveGame,
  createCard,
  createDeck,
  createPlayer,
  createUser,
  withHarness,
} = require("./helpers/harness");

describe("modals and collectors", () => {
  test("colorall shows a modal the handler can later submit", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: { subcommand: "colorall" },
      },
      async (harness) => {
        const command = new Players(harness.client);
        await command.execute(harness.interaction);
        expect(harness.calls.showModal).toHaveLength(1);
        expect(harness.calls.showModal[0].data.custom_id).toBe("colorall-modal");
      }
    );
  });

  test("colorall modal submission updates player colors via fields.getTextInputValue", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        isModalSubmit: true,
        modalCustomId: "colorall-modal",
        modalFields: {
          "color-user-1": "red",
          "color-user-2": "blue",
        },
      },
      async (harness) => {
        await modalSubmission.execute(harness.interaction);
        const saved = await harness.getSavedGame();
        expect(saved.players[0].color).toBe("red");
        expect(saved.players[1].color).toBe("blue");
        expect(harness.lastContent()).toContain("Player colors updated");
      }
    );
  });

  test("scoreall modal submission updates scores", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        isModalSubmit: true,
        modalCustomId: "scoreall-modal",
        modalFields: {
          "score-user-1": "10",
          "score-user-2": "7",
        },
      },
      async (harness) => {
        await modalSubmission.execute(harness.interaction);
        const saved = await harness.getSavedGame();
        expect(saved.players[0].score).toBe("10");
        expect(saved.players[1].score).toBe("7");
        expect(harness.lastContent()).toContain("Player scores updated");
      }
    );
  });

  test("cards deck pick uses awaitMessageComponent on the editReply message", async () => {
    const discarded = createCard({ id: "pick-me", name: "Jack", origin: "Main" });
    await withHarness(
      {
        gameData: createActiveGame({
          players: [
            createPlayer({ userId: "user-1", name: "Alice", order: 0 }),
            createPlayer({ userId: "user-2", name: "Bob", order: 1 }),
          ],
          decks: [createDeck({ name: "Main", draw: [], discard: [discarded] })],
        }),
        options: {
          subcommandGroup: "deck",
          subcommand: "pick",
          strings: { deck: "Main" },
        },
        componentInteraction: {
          user: createUser({ id: "user-1", username: "Alice" }),
          customId: "card",
          values: ["pick-me"],
        },
      },
      async (harness) => {
        const command = new Cards(harness.client);
        await command.execute(harness.interaction);
        const saved = await harness.getSavedGame();
        expect(saved.decks[0].piles.discard.cards).toHaveLength(0);
        expect(saved.players[0].hands.main.map((card) => card.id)).toEqual(["pick-me"]);
        expect(
          harness.calls.editReply.some((payload) => payload.content === "Cards Picked Back Up!")
        ).toBe(true);
        expect(harness.calls.editReply[0].fetchReply).toBe(true);
      }
    );
  });

  test("deck editcard continue button opens the save modal", async () => {
    const DeckEditCardModal = require("../modules/DeckEditCardModal");
    DeckEditCardModal.resetPendingEdits();
    const card = createCard({ id: "id-x", name: "Promo", url: "https://old.example/x.png" });
    const deck = createDeck({ name: "Main", draw: [], discard: [] });
    deck.allCards = [card];

    await withHarness(
      {
        gameData: createActiveGame({ decks: [deck] }),
        options: {
          subcommandGroup: "deck",
          subcommand: "editcard",
          strings: { deck: "Main", card: "id-x" },
        },
      },
      async (harness) => {
        const command = new Cards(harness.client);
        await command.execute(harness.interaction);
        expect(harness.calls.showModal[0].data.custom_id).toBe("editcard-step1");
      }
    );

    let nextCustomId;
    await withHarness(
      {
        gameData: createActiveGame({ decks: [deck] }),
        isModalSubmit: true,
        modalCustomId: "editcard-step1",
        modalFields: { name: "Promo", url: "https://old.example/x.png", type: "", suit: "" },
      },
      async (harness) => {
        await modalSubmission.execute(harness.interaction);
        expect(harness.lastContent()).toContain("No changes yet");
        nextCustomId = harness.calls.reply[0].components[0].components[0].data.custom_id;
      }
    );

    await withHarness(
      {
        gameData: createActiveGame({ decks: [deck] }),
        modalCustomId: nextCustomId,
      },
      async (harness) => {
        const handled = await DeckEditCardModal.handleButton(harness.interaction, harness.client);
        expect(handled).toBe(true);
        expect(harness.calls.showModal[0].data.custom_id).toBe("editcard-step2");
        expect(harness.calls.showModal[0].data.submit_label).toBe("Save");
      }
    );
  });

  test("modal field lookup throws when a custom id is missing", async () => {
    await withHarness(
      {
        isModalSubmit: true,
        modalCustomId: "colorall-modal",
        modalFields: { "color-user-1": "red" },
      },
      async (harness) => {
        expect(() => harness.interaction.fields.getTextInputValue("color-user-2")).toThrow(
          /not found/
        );
      }
    );
  });
});
