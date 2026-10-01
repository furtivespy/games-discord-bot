const { describe, expect, test } = require("bun:test");
const WinShare = require("../slashcommands/genericgame/winshare");
const {
  createActiveGame,
  createUser,
  withHarness,
} = require("./helpers/harness");

describe("/winshare", () => {
  test("links the game name to the selected channel, including forum posts", async () => {
    const gameChannel = { id: "thread-99", name: "ankh" };
    await withHarness(
      {
        options: { channels: { gamechannel: gameChannel } },
      },
      async (harness) => {
        harness.seedCollection(
          "game",
          createActiveGame({ name: "Ankh", winner: ["user-1"] }),
          { channel: gameChannel.id }
        );

        await new WinShare(harness.client).execute(harness.interaction);

        expect(harness.getCalls).toContainEqual([
          "guild-1",
          "game",
          "thread-99",
        ]);
        expect(harness.calls.reply[0].embeds[0].data.description).toBe(
          "For winning [Ankh](<https://discord.com/channels/guild-1/thread-99>) in <#thread-99>"
        );
      }
    );
  });

  test("escapes markdown in the shared game name", async () => {
    const gameChannel = { id: "channel-2", name: "star-wars" };
    await withHarness(
      {
        options: { channels: { gamechannel: gameChannel } },
      },
      async (harness) => {
        harness.seedCollection(
          "game",
          createActiveGame({ name: "Star*[Wars]", winner: ["user-1"] }),
          { channel: gameChannel.id }
        );

        await new WinShare(harness.client).execute(harness.interaction);

        expect(harness.calls.reply[0].embeds[0].data.description).toBe(
          "For winning [Star\\*\\[Wars\\]](<https://discord.com/channels/guild-1/channel-2>) in <#channel-2>"
        );
      }
    );
  });
});
