const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const path = require("path");
const {
  createActiveGame,
  createCard,
  createUser,
  withHarness,
} = require("./helpers/harness");

describe("mock interaction harness", () => {
  test("isolates GAMEBOT_DATA_DIR and restores it after cleanup", async () => {
    const previous = process.env.GAMEBOT_DATA_DIR;
    let capturedDir;

    await withHarness({}, async (harness) => {
      capturedDir = harness.dataDir;
      expect(process.env.GAMEBOT_DATA_DIR).toBe(capturedDir);
      expect(fs.existsSync(capturedDir)).toBe(true);
    });

    expect(fs.existsSync(capturedDir)).toBe(false);
    if (previous === undefined) {
      expect(process.env.GAMEBOT_DATA_DIR).toBeUndefined();
    } else {
      expect(process.env.GAMEBOT_DATA_DIR).toBe(previous);
    }
  });

  test("options getters cover subcommand, user, focused, and typed values", async () => {
    const bob = createUser({ id: "user-2", username: "Bob" });
    await withHarness(
      {
        options: {
          subcommand: "add",
          subcommandGroup: "hand",
          strings: { card: "card-1" },
          integers: { count: 3 },
          booleans: { secret: true },
          users: { player: bob },
          focused: "ace",
          focusedName: "card",
        },
      },
      async ({ interaction }) => {
        expect(interaction.options.getSubcommand()).toBe("add");
        expect(interaction.options.getSubcommandGroup()).toBe("hand");
        expect(interaction.options.getString("card")).toBe("card-1");
        expect(interaction.options.getInteger("count")).toBe(3);
        expect(interaction.options.getBoolean("secret")).toBe(true);
        expect(interaction.options.getUser("player")).toEqual(bob);
        expect(interaction.options.getFocused()).toBe("ace");
        expect(interaction.options.getFocused(true)).toEqual({
          name: "card",
          value: "ace",
        });
      }
    );
  });

  test("reply, editReply, followUp, showModal, and guild member lookups record calls", async () => {
    await withHarness(
      {
        gameData: createActiveGame(),
        members: [{ id: "user-2", displayName: "Bob", user: { id: "user-2", username: "Bob" } }],
      },
      async (harness) => {
        const { interaction } = harness;
        await interaction.deferReply();
        await interaction.editReply({ content: "edited" });
        await interaction.followUp({ content: "later" });
        await interaction.showModal({ customId: "demo-modal" });

        expect(interaction.deferred).toBe(true);
        expect(harness.calls.deferReply).toHaveLength(1);
        expect(harness.lastContent()).toBe("edited");
        expect(harness.calls.followUp[0].content).toBe("later");
        expect(harness.calls.showModal[0].customId).toBe("demo-modal");
        expect(interaction.guild.members.cache.get("user-2").displayName).toBe("Bob");
        expect((await interaction.guild.members.fetch("user-1")).displayName).toBe("Alice");
      }
    );
  });

  test("in-memory client persists game documents without opening Discord", async () => {
    await withHarness(
      { gameData: createActiveGame({ name: "Table 1" }) },
      async (harness) => {
        const saved = await harness.getSavedGame();
        expect(saved.name).toBe("Table 1");
        expect(saved.players).toHaveLength(2);

        saved.players[0].score = "12";
        await harness.client.setGameDataV2(
          harness.interaction.guildId,
          "game",
          harness.interaction.channelId,
          saved
        );

        const again = await harness.getSavedGame();
        expect(again.players[0].score).toBe("12");
        expect(harness.persistCalls).toHaveLength(1);
      }
    );
  });

  test("GameStore-backed client writes under the temp data dir", async () => {
    await withHarness(
      {
        useGameStore: true,
        gameData: createActiveGame({ name: "SQLite table" }),
      },
      async (harness) => {
        const saved = await harness.getSavedGame();
        expect(saved.name).toBe("SQLite table");
        expect(
          fs.existsSync(path.join(harness.dataDir, "game_documents.sqlite"))
        ).toBe(true);

        const card = createCard({ id: "c-store", name: "Stored" });
        saved.decks.push({
          name: "Main",
          piles: { draw: { cards: [card] }, discard: { cards: [] } },
        });
        await harness.client.setGameDataV2(
          harness.interaction.guildId,
          "game",
          harness.interaction.channelId,
          saved
        );

        const again = await harness.getSavedGame();
        expect(again.decks[0].piles.draw.cards[0].name).toBe("Stored");
      }
    );
  });

  test("queued component interaction is returned from awaitMessageComponent", async () => {
    const queued = {
      user: { id: "user-1" },
      customId: "card",
      values: ["card-1"],
    };

    await withHarness({ componentInteraction: queued }, async ({ interaction }) => {
      const message = await interaction.editReply({
        content: "Choose cards",
        fetchReply: true,
      });
      const collected = await message.awaitMessageComponent({
        filter: (i) => i.user.id === "user-1" && i.customId === "card",
      });
      expect(collected.values).toEqual(["card-1"]);
      await collected.update({ content: "acked" });
      expect(collected.deferUpdate).toBeTypeOf("function");
    });
  });

  test("collector times out when time is 0 even if a component is queued", async () => {
    await withHarness(
      { componentInteraction: { user: { id: "user-1" }, customId: "card", values: ["x"] } },
      async ({ interaction }) => {
        const message = await interaction.editReply({
          content: "Choose",
          fetchReply: true,
        });
        await expect(
          message.awaitMessageComponent({ time: 0 })
        ).rejects.toMatchObject({ code: "InteractionCollectorError" });
      }
    );
  });

  test("reply without fetchReply does not expose a collector", async () => {
    await withHarness(
      { componentInteraction: { user: { id: "user-1" }, customId: "card", values: ["x"] } },
      async ({ interaction }) => {
        const message = await interaction.reply({ content: "no fetch" });
        expect(message.awaitMessageComponent).toBeUndefined();
      }
    );
  });

  test("required option getters and modal fields throw like discord.js", async () => {
    await withHarness({}, async ({ interaction }) => {
      expect(() => interaction.options.getSubcommand()).toThrow(/Subcommand is required/);
      expect(() => interaction.options.getSubcommandGroup()).toThrow(/Subcommand group is required/);
      expect(interaction.options.getSubcommandGroup(false)).toBeNull();
      expect(() => interaction.options.getFocused()).toThrow(/Focused option is required/);
      expect(() => interaction.fields.getTextInputValue("missing")).toThrow(/not found/);
    });
  });
});
