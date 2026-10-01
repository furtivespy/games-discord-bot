const { describe, expect, test } = require("bun:test");
const WinShare = require("../slashcommands/genericgame/winshare");
const {
  createActiveGame,
  createUser,
  withHarness,
} = require("./helpers/harness");

describe("/winshare", () => {
  test("links the game name to BGG when the session has a bggGameId, including forum posts", async () => {
    const gameChannel = { id: "thread-99", name: "ankh" };
    await withHarness(
      {
        options: { channels: { gamechannel: gameChannel } },
      },
      async (harness) => {
        harness.seedCollection(
          "game",
          createActiveGame({
            name: "Ankh",
            winner: ["user-1"],
            bggGameId: "285774",
          }),
          { channel: gameChannel.id }
        );

        await new WinShare(harness.client).execute(harness.interaction);

        expect(harness.getCalls).toContainEqual([
          "guild-1",
          "game",
          "thread-99",
        ]);
        expect(harness.calls.reply[0].embeds[0].data.description).toBe(
          "For winning [Ankh](https://boardgamegeek.com/boardgame/285774) in <#thread-99>"
        );
      }
    );
  });

  test("mentions the game channel without a BGG link when no bggGameId is stored", async () => {
    const gameChannel = { id: "thread-99", name: "ankh" };
    await withHarness(
      {
        options: { channels: { gamechannel: gameChannel } },
      },
      async (harness) => {
        harness.seedCollection(
          "game",
          createActiveGame({
            name: "Ankh",
            winner: ["user-1"],
            bggGameId: null,
            isCustomGame: true,
          }),
          { channel: gameChannel.id }
        );

        await new WinShare(harness.client).execute(harness.interaction);

        const description = harness.calls.reply[0].embeds[0].data.description;
        expect(description).toBe("For winning Ankh in <#thread-99>");
        expect(description).not.toContain("boardgamegeek.com");
      }
    );
  });

  test("escapes markdown in the BGG-linked game name", async () => {
    const gameChannel = { id: "channel-2", name: "star-wars" };
    await withHarness(
      {
        options: { channels: { gamechannel: gameChannel } },
      },
      async (harness) => {
        harness.seedCollection(
          "game",
          createActiveGame({
            name: "Star*[Wars]",
            winner: ["user-1"],
            bggGameId: "13",
          }),
          { channel: gameChannel.id }
        );

        await new WinShare(harness.client).execute(harness.interaction);

        expect(harness.calls.reply[0].embeds[0].data.description).toBe(
          "For winning [Star\\*\\[Wars\\]](https://boardgamegeek.com/boardgame/13) in <#channel-2>"
        );
      }
    );
  });
});
