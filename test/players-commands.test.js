const { describe, expect, test } = require("bun:test");
const Players = require("../slashcommands/players/players");
const {
  createActiveGame,
  createPlayer,
  createUser,
  withHarness,
} = require("./helpers/harness");

async function runPlayers(harness) {
  const command = new Players(harness.client);
  await command.execute(harness.interaction);
}

describe("/players command handlers", () => {
  test("add appends a new player at the end of turn order", async () => {
    const charlie = createUser({ id: "user-3", username: "Charlie" });
    await withHarness(
      {
        gameData: createActiveGame(),
        options: { subcommand: "add", users: { player: charlie } },
      },
      async (harness) => {
        await runPlayers(harness);
        const saved = await harness.getSavedGame();
        expect(saved.players).toHaveLength(3);
        expect(saved.players[2]).toMatchObject({
          userId: "user-3",
          name: "Charlie",
          order: 2,
        });
        expect(harness.lastContent()).toContain("Added <@user-3>");
        expect(saved.history.at(-1).action.type).toBe("add");
      }
    );
  });

  test("add refuses a player who is already seated", async () => {
    const alice = createUser({ id: "user-1", username: "Alice" });
    await withHarness(
      {
        gameData: createActiveGame(),
        options: { subcommand: "add", users: { player: alice } },
      },
      async (harness) => {
        await runPlayers(harness);
        expect(harness.lastContent()).toContain("already in this game");
        expect((await harness.getSavedGame()).players).toHaveLength(2);
      }
    );
  });

  test("remove drops a player and reorders the rest", async () => {
    const bob = createUser({ id: "user-2", username: "Bob" });
    await withHarness(
      {
        gameData: createActiveGame({
          players: [
            createPlayer({ userId: "user-1", name: "Alice", order: 0 }),
            createPlayer({ userId: "user-2", name: "Bob", order: 1 }),
            createPlayer({ userId: "user-3", name: "Charlie", order: 2 }),
          ],
        }),
        options: { subcommand: "remove", users: { player: bob } },
      },
      async (harness) => {
        await runPlayers(harness);
        const saved = await harness.getSavedGame();
        expect(saved.players.map((player) => player.userId)).toEqual([
          "user-1",
          "user-3",
        ]);
        expect(saved.players.map((player) => player.order)).toEqual([0, 1]);
        expect(harness.lastContent()).toContain("Removed <@user-2>");
      }
    );
  });

  test("score updates the named player and defaults to the caller", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        options: { subcommand: "score", strings: { score: "17" } },
      },
      async (harness) => {
        await runPlayers(harness);
        const saved = await harness.getSavedGame();
        expect(saved.players[0].score).toBe("17");
        expect(saved.players[1].score).toBe("");
        expect(harness.lastContent()).toContain("score to: 17");
      }
    );
  });

  test("score rejects a user who is not in the game", async () => {
    const outsider = createUser({ id: "user-99", username: "Eve" });
    await withHarness(
      {
        gameData: createActiveGame(),
        options: {
          subcommand: "score",
          strings: { score: "5" },
          users: { player: outsider },
        },
      },
      async (harness) => {
        await runPlayers(harness);
        expect(harness.lastContent()).toContain("is not in this game");
      }
    );
  });

  test("first rotates turn order so the chosen player is order 0", async () => {
    const bob = createUser({ id: "user-2", username: "Bob" });
    await withHarness(
      {
        gameData: createActiveGame({
          players: [
            createPlayer({ userId: "user-1", name: "Alice", order: 0 }),
            createPlayer({ userId: "user-2", name: "Bob", order: 1 }),
            createPlayer({ userId: "user-3", name: "Charlie", order: 2 }),
          ],
        }),
        options: { subcommand: "first", users: { player: bob } },
      },
      async (harness) => {
        await runPlayers(harness);
        const saved = await harness.getSavedGame();
        const byId = Object.fromEntries(
          saved.players.map((player) => [player.userId, player.order])
        );
        expect(byId["user-2"]).toBe(0);
        expect(byId["user-3"]).toBe(1);
        expect(byId["user-1"]).toBe(2);
        expect(harness.lastContent()).toContain("is now the first player");
      }
    );
  });

  test("color sets a player's color string", async () => {
    const alice = createUser({ id: "user-1", username: "Alice" });
    await withHarness(
      {
        gameData: createActiveGame(),
        options: {
          subcommand: "color",
          strings: { color: "#ff0000" },
          users: { player: alice },
        },
      },
      async (harness) => {
        await runPlayers(harness);
        const saved = await harness.getSavedGame();
        expect(saved.players[0].color).toBe("#ff0000");
        expect(harness.lastContent()).toContain("#ff0000");
      }
    );
  });

  test("help is routed through the players slash command", async () => {
    await withHarness(
      { options: { subcommand: "help" } },
      async (harness) => {
        await runPlayers(harness);
        const bodies = [
          harness.calls.reply[0]?.content,
          ...harness.calls.followUp.map((payload) => payload.content),
        ]
          .filter(Boolean)
          .join("\n");
        expect(bodies.toLowerCase()).toContain("player");
      }
    );
  });

  test("commands refuse to mutate a deleted game", async () => {
    const charlie = createUser({ id: "user-3", username: "Charlie" });
    await withHarness(
      {
        gameData: createActiveGame({ isdeleted: true }),
        options: { subcommand: "add", users: { player: charlie } },
      },
      async (harness) => {
        await runPlayers(harness);
        expect(harness.lastContent()).toContain("No active game");
        expect((await harness.getSavedGame()).players).toHaveLength(2);
      }
    );
  });
});
