const { describe, expect, test } = require("bun:test");
const GameStatusHelper = require("../modules/GameStatusHelper");
const Cards = require("../slashcommands/genericgame/cards");
const Game = require("../slashcommands/genericgame/game");
const Tokens = require("../slashcommands/genericgame/tokens");
const Secret = require("../slashcommands/genericgame/secret");
const Money = require("../slashcommands/genericgame/money");
const {
  createActiveGame,
  createCard,
  createDeck,
  createPlayer,
  createUser,
  withHarness,
} = require("./helpers/harness");

function pinnedGame(overrides = {}) {
  return createActiveGame({
    pinnedStatusMode: "on",
    pinnedStatusEnabled: true,
    pinnedStatusMessageId: "pin-1",
    pinnedStatusChannelId: "channel-1",
    pinnedStatusPinned: true,
    ...overrides,
  });
}

function pinEdits(harness) {
  return harness.editCalls.filter(
    (payload) =>
      typeof payload.content === "string" &&
      payload.content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)
  );
}

function extraStatusSends(harness) {
  return harness.sendCalls.filter((payload) => {
    const content = payload?.content;
    if (typeof content === "string" && content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)) {
      return false;
    }
    return Boolean(payload?.embeds?.length || payload?.files?.length);
  });
}

function gameWithDeckAndPin({
  draw = [],
  discard = [],
  hand = [],
  ...overrides
} = {}) {
  return pinnedGame({
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
    ...overrides,
  });
}

async function runCards(harness) {
  await new Cards(harness.client).execute(harness.interaction);
}

async function runGame(harness) {
  await new Game(harness.client).execute(harness.interaction);
}

async function runTokens(harness) {
  await new Tokens(harness.client).execute(harness.interaction);
}

async function runSecret(harness) {
  await new Secret(harness.client).execute(harness.interaction);
}

async function runMoney(harness) {
  await new Money(harness.client).execute(harness.interaction);
}

describe("pinned live status refresh after game-state saves", () => {
  test("saving channel game data with pin off does not touch Discord pins", async () => {
    await withHarness({ gameData: createActiveGame() }, async (harness) => {
      const saved = await harness.getSavedGame();
      saved.players[0].score = "3";
      await harness.client.setGameDataV2(
        harness.interaction.guildId,
        "game",
        harness.interaction.channelId,
        saved
      );

      expect(pinEdits(harness)).toHaveLength(0);
      expect(harness.sendCalls).toHaveLength(0);
      expect(harness.pinCalls).toHaveLength(0);
    });
  });

  test("saving channel game data with pin on edits the pin in place", async () => {
    await withHarness({ gameData: pinnedGame() }, async (harness) => {
      const saved = await harness.getSavedGame();
      saved.players[0].score = "7";
      await harness.client.setGameDataV2(
        harness.interaction.guildId,
        "game",
        harness.interaction.channelId,
        saved
      );

      expect(pinEdits(harness).length).toBeGreaterThanOrEqual(1);
      expect(harness.sendCalls).toHaveLength(0);
      expect(extraStatusSends(harness)).toHaveLength(0);
    });
  });

  test("deleted games do not recreate a pin on save", async () => {
    await withHarness(
      {
        gameData: pinnedGame({ isdeleted: true }),
      },
      async (harness) => {
        const saved = await harness.getSavedGame();
        await harness.client.setGameDataV2(
          harness.interaction.guildId,
          "game",
          harness.interaction.channelId,
          saved
        );

        expect(pinEdits(harness)).toHaveLength(0);
        expect(harness.sendCalls).toHaveLength(0);
      }
    );
  });

  test("secret-store persists do not refresh the public pin", async () => {
    await withHarness({ gameData: pinnedGame() }, async (harness) => {
      await harness.client.setGameDataV2(
        harness.interaction.guildId,
        "secret",
        harness.interaction.channelId,
        { isrevealed: false, players: [{ userId: "user-1", secret: "the-hidden-word" }] }
      );

      expect(pinEdits(harness)).toHaveLength(0);
      expect(harness.sendCalls).toHaveLength(0);
    });
  });

  test("/cards hand play refreshes the pin without posting a second status table", async () => {
    const card = createCard({ id: "play-1", name: "Ace", origin: "Main" });
    await withHarness(
      {
        gameData: gameWithDeckAndPin({ draw: [], hand: [card] }),
        options: {
          subcommandGroup: "hand",
          subcommand: "play",
          strings: { card: "play-1", destination: "discard" },
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toContain("Played to discard pile");
        expect(pinEdits(harness).length).toBeGreaterThanOrEqual(1);
        expect(extraStatusSends(harness)).toHaveLength(0);
        expect((await harness.getSavedGame()).players[0].hands.main).toHaveLength(0);
      }
    );
  });

  test("/cards pile draw (ephemeral) still refreshes the public pin", async () => {
    const drawn = createCard({ id: "p1", name: "Market Card", origin: "Main" });
    await withHarness(
      {
        gameData: gameWithDeckAndPin({
          globalPiles: [
            { id: "pile-1", name: "Market", cards: [drawn], isSecret: false },
          ],
        }),
        options: {
          subcommandGroup: "pile",
          subcommand: "draw",
          strings: { pile: "pile-1" },
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.lastContent()).toContain("You drew Market Card from Market");
        expect(pinEdits(harness).length).toBeGreaterThanOrEqual(1);
        expect(extraStatusSends(harness)).toHaveLength(0);
        const saved = await harness.getSavedGame();
        expect(saved.globalPiles[0].cards).toHaveLength(0);
        expect(saved.players[0].hands.main.map((item) => item.id)).toEqual(["p1"]);
      }
    );
  });

  test("/tokens gain refreshes the pin and keeps the token reply", async () => {
    await withHarness(
      {
        gameData: pinnedGame({
          tokens: [{ id: "tok-coin", name: "Coin", cap: null, isSecret: false }],
        }),
        options: {
          subcommand: "gain",
          strings: { name: "Coin" },
          integers: { amount: 2 },
        },
      },
      async (harness) => {
        await runTokens(harness);
        expect(harness.lastContent()).toContain("gained 2 Coin");
        expect(pinEdits(harness).length).toBeGreaterThanOrEqual(1);
        expect(extraStatusSends(harness)).toHaveLength(0);
        const saved = await harness.getSavedGame();
        expect(saved.players[0].tokens["tok-coin"]).toBe(2);
      }
    );
  });

  test("/game playarea refreshes the pin", async () => {
    await withHarness(
      {
        gameData: pinnedGame({ playToPlayArea: false }),
        options: { subcommand: "playarea", strings: { mode: "on" } },
      },
      async (harness) => {
        await runGame(harness);
        expect(harness.lastContent()).toContain("ON");
        expect(pinEdits(harness).length).toBeGreaterThanOrEqual(1);
        expect(extraStatusSends(harness)).toHaveLength(0);
        expect(await harness.getSavedGame()).toMatchObject({ playToPlayArea: true });
      }
    );
  });

  test("/game historyadd refreshes Recent Actions on the pin", async () => {
    await withHarness(
      {
        gameData: pinnedGame(),
        options: { subcommand: "historyadd", strings: { text: "Alice took the lead" } },
      },
      async (harness) => {
        await runGame(harness);
        expect(harness.lastContent()).toContain("Alice took the lead");
        expect(pinEdits(harness).length).toBeGreaterThanOrEqual(1);
        expect(extraStatusSends(harness)).toHaveLength(0);
      }
    );
  });

  test("/game winner refreshes the pin without posting a status table", async () => {
    const alice = createUser({ id: "user-1", username: "Alice" });
    await withHarness(
      {
        gameData: pinnedGame({ name: "Final Table" }),
        options: { subcommand: "winner", users: { player1: alice } },
      },
      async (harness) => {
        await runGame(harness);
        expect(pinEdits(harness).length).toBeGreaterThanOrEqual(1);
        expect(extraStatusSends(harness)).toHaveLength(0);
        expect((await harness.getSavedGame()).winner).toEqual(["user-1"]);
      }
    );
  });

  test("/money spend refreshes the pin without leaking a second status post", async () => {
    await withHarness(
      {
        gameData: pinnedGame({
          players: [
            createPlayer({ userId: "user-1", name: "Alice", order: 0, money: 10 }),
            createPlayer({ userId: "user-2", name: "Bob", order: 1 }),
          ],
        }),
        options: { subcommand: "spend", integers: { amount: 3 } },
      },
      async (harness) => {
        await runMoney(harness);
        expect(harness.lastContent()).toContain("spent $3");
        expect(pinEdits(harness).length).toBeGreaterThanOrEqual(1);
        expect(extraStatusSends(harness)).toHaveLength(0);
        expect((await harness.getSavedGame()).players[0].money).toBe(7);
      }
    );
  });

  test("/secret add refreshes the pin from game history without putting secret text on it", async () => {
    const secretText = "the-hidden-assassination-target";
    await withHarness(
      {
        gameData: pinnedGame(),
        options: { subcommand: "add", strings: { secret: secretText } },
      },
      async (harness) => {
        await runSecret(harness);
        expect(pinEdits(harness).length).toBeGreaterThanOrEqual(1);
        const pinBlob = JSON.stringify(pinEdits(harness));
        expect(pinBlob).not.toContain(secretText);
        expect(extraStatusSends(harness)).toHaveLength(0);
        const savedGame = await harness.getSavedGame();
        expect(savedGame.history.at(-1).summary).toContain("added their secret");
        expect(JSON.stringify(savedGame)).not.toContain(secretText);
      }
    );
  });

  test("/game delete clears the pin and does not recreate it", async () => {
    await withHarness(
      {
        gameData: pinnedGame({ name: "Doomed Table" }),
        options: { subcommand: "delete", strings: { confirm: "delete" } },
      },
      async (harness) => {
        harness.pinMessage.pinned = true;
        await runGame(harness);
        expect(harness.lastContent()).toContain("Game Deleted");
        expect(harness.unpinCalls).toHaveLength(1);
        expect((await harness.getSavedGame()).isdeleted).toBe(true);
        const recreateSends = harness.sendCalls.filter(
          (payload) =>
            typeof payload.content === "string" &&
            payload.content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER) &&
            !payload.content.includes("this game has ended")
        );
        expect(recreateSends).toHaveLength(0);
      }
    );
  });
});
