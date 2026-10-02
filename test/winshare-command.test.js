const { describe, expect, test } = require("bun:test");
const WinShare = require("../slashcommands/genericgame/winshare");
const {
  createActiveGame,
  createUser,
  withHarness,
} = require("./helpers/harness");

describe("/winshare", () => {
  test("defers before the game load finishes", async () => {
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
          }),
          { channel: gameChannel.id }
        );

        let releaseLoad;
        const gate = new Promise((resolve) => {
          releaseLoad = resolve;
        });
        const orig = harness.client.getGameDataV2.bind(harness.client);
        harness.client.getGameDataV2 = async (...args) => {
          await gate;
          return orig(...args);
        };

        const run = new WinShare(harness.client).execute(harness.interaction);
        expect(harness.interaction.deferred).toBe(true);
        expect(harness.calls.editReply).toHaveLength(0);
        expect(harness.calls.reply).toHaveLength(0);

        releaseLoad();
        await run;
        expect(harness.calls.editReply[0].embeds[0].data.description).toContain(
          "Ankh"
        );
      }
    );
  });

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
        expect(harness.calls.deferReply).toHaveLength(1);
        expect(harness.calls.reply).toHaveLength(0);
        expect(harness.calls.editReply[0].embeds[0].data.description).toBe(
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

        const description = harness.calls.editReply[0].embeds[0].data.description;
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

        expect(harness.calls.editReply[0].embeds[0].data.description).toBe(
          "For winning [Star\\*\\[Wars\\]](https://boardgamegeek.com/boardgame/13) in <#channel-2>"
        );
      }
    );
  });

  test("attaches a stored winner portrait as the embed image without regenerating", async () => {
    const WinnerPortrait = require("../modules/WinnerPortrait");
    const originalFetch = WinnerPortrait.fetchStoredPortraitBuffer;
    const originalGenerate = WinnerPortrait.generatePortraitImage;
    WinnerPortrait.fetchStoredPortraitBuffer = async () => Buffer.from("portrait-bytes");
    WinnerPortrait.generatePortraitImage = async () => {
      throw new Error("winshare must not regenerate");
    };

    try {
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
              winnerPortrait: {
                winnerUserIds: ["user-1"],
                channelId: "thread-99",
                messageId: "portrait-msg",
              },
            }),
            { channel: gameChannel.id }
          );

          await new WinShare(harness.client).execute(harness.interaction);

          expect(harness.calls.reply).toHaveLength(0);
          expect(harness.calls.editReply[0].files).toBeUndefined();
          const payload = harness.calls.editReply[1];
          expect(payload.embeds[0].data.image.url).toBe(
            "attachment://winner-portrait.png"
          );
          expect(payload.files).toHaveLength(1);
        }
      );
    } finally {
      WinnerPortrait.fetchStoredPortraitBuffer = originalFetch;
      WinnerPortrait.generatePortraitImage = originalGenerate;
    }
  });

  test("does not attach a stored portrait when winnerUserIds do not match current winners", async () => {
    const WinnerPortrait = require("../modules/WinnerPortrait");
    const originalFetch = WinnerPortrait.fetchStoredPortraitBuffer;
    WinnerPortrait.fetchStoredPortraitBuffer = async () => {
      throw new Error("winshare must not refetch a mismatched portrait");
    };

    try {
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
              winnerPortrait: {
                winnerUserIds: ["user-2"],
                channelId: "thread-99",
                messageId: "alice-portrait",
              },
            }),
            { channel: gameChannel.id }
          );

          await new WinShare(harness.client).execute(harness.interaction);

          expect(harness.calls.editReply).toHaveLength(1);
          expect(harness.calls.editReply[0].embeds[0].data.image).toBeUndefined();
          expect(harness.calls.editReply[0].files).toBeUndefined();
        }
      );
    } finally {
      WinnerPortrait.fetchStoredPortraitBuffer = originalFetch;
    }
  });
});
