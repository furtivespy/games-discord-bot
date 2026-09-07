const { describe, expect, test } = require("bun:test");
const Game = require("../slashcommands/genericgame/game");
const {
  collectedReplyText,
  createActiveGame,
  createUser,
  withBggStub,
  withHarness,
} = require("./helpers/harness");

async function runGame(harness) {
  const command = new Game(harness.client);
  await command.execute(harness.interaction);
}

describe("/game command handlers", () => {
  test("help replies with the generic game intro and follow-up chunks", async () => {
    await withHarness(
      { options: { subcommand: "help" } },
      async (harness) => {
        await runGame(harness);
        const bodies = collectedReplyText(harness);
        expect(bodies).toContain("Generic Game Zone");
        expect(bodies).toContain("/game newgame");
        expect(harness.calls.followUp.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  test("next notifies the following player in turn order", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: { subcommand: "next" },
      },
      async (harness) => {
        await runGame(harness);
        expect(harness.calls.reply[0].content).toBe("<@user-2>, it's your turn!");
      }
    );
  });

  test("next wraps around and respects reverse order", async () => {
    await withHarness(
      {
        user: createUser({ id: "user-2", username: "Bob" }),
        gameData: createActiveGame({ reverseOrder: true }),
        options: { subcommand: "next" },
      },
      async (harness) => {
        await runGame(harness);
        expect(harness.calls.reply[0].content).toBe("<@user-1>, it's your turn!");
      }
    );
  });

  test("next rejects a user who is not in the game", async () => {
    await withHarness(
      {
        user: createUser({ id: "user-99", username: "Spectator" }),
        gameData: createActiveGame(),
        options: { subcommand: "next" },
      },
      async (harness) => {
        await runGame(harness);
        expect(harness.lastContent()).toBe("You're not playing in this game!");
      }
    );
  });

  test("reverse toggles turn order and persists history", async () => {
    await withHarness(
      {
        gameData: createActiveGame({ reverseOrder: false }),
        options: { subcommand: "reverse" },
      },
      async (harness) => {
        await runGame(harness);
        const saved = await harness.getSavedGame();
        expect(saved.reverseOrder).toBe(true);
        expect(harness.lastContent()).toContain("reversed");
        expect(saved.history.at(-1).action.type).toBe("reverse");
      }
    );
  });

  test("delete without confirm does not touch the game", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: { subcommand: "delete", strings: { confirm: "nope" } },
      },
      async (harness) => {
        await runGame(harness);
        expect(harness.lastContent()).toBe("Nothing Deleted...");
        expect((await harness.getSavedGame()).isdeleted).toBe(false);
      }
    );
  });

  test("delete with confirm marks the game deleted", async () => {
    await withHarness(
      {
        gameData: createActiveGame({ name: "Doomed" }),
        options: { subcommand: "delete", strings: { confirm: "delete" } },
      },
      async (harness) => {
        await runGame(harness);
        const saved = await harness.getSavedGame();
        expect(saved.isdeleted).toBe(true);
        expect(harness.lastContent()).toBe("Game Deleted!?");
        expect(saved.history.some((entry) => entry.action.type === "delete")).toBe(
          true
        );
      }
    );
  });

  test("status reports no game when the channel is empty", async () => {
    await withHarness(
      { options: { subcommand: "status" } },
      async (harness) => {
        await runGame(harness);
        expect(harness.lastContent()).toBe("No game in progress!");
      }
    );
  });

  test("status posts a game status reply for an active game", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: { subcommand: "status" },
      },
      async (harness) => {
        await runGame(harness);
        const saved = await harness.getSavedGame();
        expect(harness.calls.deferReply).toHaveLength(1);
        expect(saved.lastStatusMessageId).toBe("chat-1");
        expect(saved.players).toHaveLength(2);
        expect(saved.isdeleted).toBe(false);
        expect(harness.persistCalls.length).toBeGreaterThanOrEqual(1);
      }
    );
  });

  test("historyadd appends a manual note", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: {
          subcommand: "historyadd",
          strings: { text: "end of round 1" },
        },
      },
      async (harness) => {
        await runGame(harness);
        const saved = await harness.getSavedGame();
        expect(harness.lastContent()).toContain('Added to history: "end of round 1"');
        expect(saved.history.at(-1)).toMatchObject({
          action: { category: "game", type: "note" },
          summary: expect.stringContaining("end of round 1"),
        });
      }
    );
  });

  test("historyadd rejects an empty channel", async () => {
    await withHarness(
      {
        options: {
          subcommand: "historyadd",
          strings: { text: "should fail" },
        },
      },
      async (harness) => {
        await runGame(harness);
        expect(harness.lastContent()).toContain("No active game");
      }
    );
  });

  test("playarea turns the personal play-area setting on", async () => {
    await withHarness(
      {
        gameData: createActiveGame({ playToPlayArea: false }),
        options: { subcommand: "playarea", strings: { mode: "on" } },
      },
      async (harness) => {
        await runGame(harness);
        expect(await harness.getSavedGame()).toMatchObject({ playToPlayArea: true });
        expect(harness.lastContent()).toContain("ON");
      }
    );
  });

  test("winner records matching players and replies with an embed", async () => {
    const alice = createUser({ id: "user-1", username: "Alice" });
    await withHarness(
      {
        gameData: createActiveGame({ name: "Final Table" }),
        options: { subcommand: "winner", users: { player1: alice } },
      },
      async (harness) => {
        await runGame(harness);
        const saved = await harness.getSavedGame();
        expect(saved.winner).toEqual(["user-1"]);
        expect(harness.calls.reply[0].embeds[0].data.title).toContain("Alice");
      }
    );
  });

  test("newgame rejects a non-numeric game id without calling BGG", async () => {
    await withHarness(
      {
        options: {
          subcommand: "newgame",
          strings: { game: "not-an-id" },
          users: { player1: createUser() },
        },
      },
      async (harness) => {
        await runGame(harness);
        expect(harness.lastContent()).toContain("Please provide a game name or ID");
        expect(await harness.getSavedGame()).toBeNull();
      }
    );
  });

  test("newgame on an existing channel only stores the BGG id", async () => {
    await withHarness(
      {
        gameData: createActiveGame({ name: "Already Going" }),
        options: {
          subcommand: "newgame",
          strings: { game: "13" },
          users: { player1: createUser() },
        },
      },
      async (harness) => {
        await runGame(harness);
        const saved = await harness.getSavedGame();
        expect(saved.bggGameId).toBe("13");
        expect(saved.players).toHaveLength(2);
        expect(harness.lastContent()).toContain("existing game");
      }
    );
  });

  test("newgame creates players and stubs BGG at the module boundary", async () => {
    await withBggStub(
      {
        CreateAndLoad: async () => ({
          embeds: [{ title: "Stubbed Catan" }],
          attachments: [],
          otherAttachments: [],
          LoadEmbeds: async () => {},
        }),
      },
      async () => {
        await withHarness(
          {
            options: {
              subcommand: "newgame",
              strings: { game: "13" },
              users: {
                player1: createUser({ id: "user-1", username: "Alice" }),
                player2: createUser({ id: "user-2", username: "Bob" }),
              },
            },
          },
          async (harness) => {
            await runGame(harness);
            const saved = await harness.getSavedGame();
            expect(saved.isdeleted).toBe(false);
            expect(saved.bggGameId).toBe("13");
            expect(saved.players).toHaveLength(2);
            expect(saved.players.map((player) => player.userId).sort()).toEqual([
              "user-1",
              "user-2",
            ]);
            expect(harness.calls.editReply[0].content).toBe("New Game Created!");
            expect(harness.calls.editReply[0].embeds[0].title).toBe("Stubbed Catan");
          }
        );
      }
    );
  });

  test("newgame autocomplete uses a stubbed BGG search", async () => {
    await withBggStub(
      {
        Search: async (query) => {
          expect(query).toBe("catan");
          return [{ name: "Catan (1995)", value: "13" }];
        },
      },
      async () => {
        await withHarness(
          {
            isAutocomplete: true,
            options: {
              subcommand: "newgame",
              strings: { game: "catan" },
            },
          },
          async (harness) => {
            await runGame(harness);
            expect(harness.calls.respond[0]).toEqual([
              { name: "Catan (1995)", value: "13" },
            ]);
          }
        );
      }
    );
  });

  test("reverse persists through GameStore SQLite in the temp data dir", async () => {
    await withHarness(
      {
        useGameStore: true,
        gameData: createActiveGame({ reverseOrder: false }),
        options: { subcommand: "reverse" },
      },
      async (harness) => {
        await runGame(harness);
        const saved = await harness.getSavedGame();
        expect(saved.reverseOrder).toBe(true);
        expect(saved.history.at(-1).action.type).toBe("reverse");
      }
    );
  });
});
