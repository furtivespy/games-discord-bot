const { describe, expect, test, afterEach } = require("bun:test");
const { MessageFlags } = require("discord.js");
const Game = require("../slashcommands/genericgame/game");
const GameFormatter = require("../modules/GameFormatter");
const WinnerPortrait = require("../modules/WinnerPortrait");
const {
  createGeminiAI,
  extractInlineImage,
  resolveImageModel,
  DEFAULT_GEMINI_IMAGE_MODEL,
} = require("../modules/GoogleGemini");
const {
  collectedReplyText,
  createActiveGame,
  createUser,
  withHarness,
} = require("./helpers/harness");

const PNG_BYTES = Buffer.from("fake-png-bytes");

async function runGame(harness) {
  const command = new Game(harness.client);
  await command.execute(harness.interaction);
}

function stubPortrait(method, impl) {
  const original = WinnerPortrait[method];
  WinnerPortrait[method] = impl;
  return () => {
    WinnerPortrait[method] = original;
  };
}

describe("winner portrait prompt and decisions", () => {
  test("buildPrompt keeps the tunable constant, game name, royalty, and no image text", () => {
    expect(WinnerPortrait.WINNER_PORTRAIT_PROMPT).toContain("{{gameName}}");
    expect(WinnerPortrait.WINNER_PORTRAIT_PROMPT.toLowerCase()).toContain("royalty");
    expect(WinnerPortrait.WINNER_PORTRAIT_PROMPT.toLowerCase()).toContain("gender-neutral");
    expect(WinnerPortrait.WINNER_PORTRAIT_PROMPT.toLowerCase()).not.toMatch(/\bking\b/);
    expect(WinnerPortrait.WINNER_PORTRAIT_PROMPT.toLowerCase()).not.toMatch(/\bqueen\b/);
    expect(WinnerPortrait.WINNER_PORTRAIT_PROMPT.toLowerCase()).toContain(
      "do not include any text"
    );

    const prompt = WinnerPortrait.buildPrompt("Ankh");
    expect(prompt).toContain("Ankh");
    expect(prompt).not.toContain("{{gameName}}");
  });

  test("skips portraits when there are more than 4 winners", () => {
    const decision = WinnerPortrait.decidePortraitAction({
      winnerIds: ["1", "2", "3", "4", "5"],
      portraitOption: true,
      guildEnabled: true,
      hasGeminiKey: true,
    });
    expect(decision).toEqual({ action: "skip", reason: "too-many-winners" });
  });

  test("generates a group portrait for up to 4 winners", () => {
    const decision = WinnerPortrait.decidePortraitAction({
      winnerIds: ["a", "b", "c", "d"],
      portraitOption: true,
      guildEnabled: true,
      hasGeminiKey: true,
    });
    expect(decision.action).toBe("generate");
    expect(decision.winnerIds).toEqual(["a", "b", "c", "d"]);
  });

  test("reuses a stored portrait when the winners are unchanged", () => {
    const decision = WinnerPortrait.decidePortraitAction({
      winnerIds: ["user-2", "user-1"],
      existingPortrait: {
        winnerUserIds: ["user-1", "user-2"],
        channelId: "channel-1",
        messageId: "msg-1",
      },
      portraitOption: true,
      guildEnabled: true,
      hasGeminiKey: true,
    });
    expect(decision.action).toBe("reuse");
  });

  test("regenerates when the winner list changes", () => {
    const decision = WinnerPortrait.decidePortraitAction({
      winnerIds: ["user-1", "user-3"],
      existingPortrait: {
        winnerUserIds: ["user-1", "user-2"],
        channelId: "channel-1",
        messageId: "msg-1",
      },
      portraitOption: true,
      guildEnabled: true,
      hasGeminiKey: true,
    });
    expect(decision.action).toBe("generate");
  });

  test("does not reuse a stored URL-less record that is missing channel or message id", () => {
    const decision = WinnerPortrait.decidePortraitAction({
      winnerIds: ["user-1"],
      existingPortrait: {
        winnerUserIds: ["user-1"],
        url: "https://cdn.discordapp.com/expired.png",
      },
      portraitOption: true,
      guildEnabled: true,
      hasGeminiKey: true,
    });
    expect(decision.action).toBe("generate");
  });

  test("portrait:false and a disabled guild skip generation", () => {
    expect(
      WinnerPortrait.decidePortraitAction({
        winnerIds: ["user-1"],
        portraitOption: false,
        guildEnabled: true,
        hasGeminiKey: true,
      }).reason
    ).toBe("opt-out");
    expect(
      WinnerPortrait.decidePortraitAction({
        winnerIds: ["user-1"],
        portraitOption: true,
        guildEnabled: false,
        hasGeminiKey: true,
      }).reason
    ).toBe("guild-disabled");
  });

  test("missing Gemini key skips quietly with a log flag", () => {
    const decision = WinnerPortrait.decidePortraitAction({
      winnerIds: ["user-1"],
      portraitOption: true,
      guildEnabled: true,
      hasGeminiKey: false,
    });
    expect(decision).toMatchObject({
      action: "skip",
      reason: "missing-gemini-key",
      log: true,
    });
  });
});

describe("Gemini image extraction (mocked)", () => {
  test("uses the configured image model name instead of a hardcoded one", () => {
    expect(
      resolveImageModel({ config: { geminiImageModel: "my-custom-image-model" } })
    ).toBe("my-custom-image-model");
    expect(resolveImageModel({ config: {} })).toBe(DEFAULT_GEMINI_IMAGE_MODEL);
  });

  test("generateImage sends avatars as inline data to the configured model", async () => {
    const gemini = createGeminiAI({
      config: { geminiKey: "test-key", geminiImageModel: "configured-image-model" },
      logger: { warn() {}, error() {} },
    });
    let captured = null;
    gemini.AI2 = {
      models: {
        generateContent: async (params) => {
          captured = params;
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: "image/png",
                        data: PNG_BYTES.toString("base64"),
                      },
                    },
                  ],
                },
              },
            ],
          };
        },
      },
    };

    const result = await gemini.generateImage({
      prompt: "royalty",
      images: [{ mimeType: "image/png", data: "avatar-base64" }],
    });

    expect(captured.model).toBe("configured-image-model");
    expect(captured.contents[0].text).toBe("royalty");
    expect(captured.contents[1].inlineData).toEqual({
      mimeType: "image/png",
      data: "avatar-base64",
    });
    expect(result.buffer.equals(PNG_BYTES)).toBe(true);
  });

  test("safety blocks and missing images return null instead of throwing", () => {
    expect(
      extractInlineImage({
        promptFeedback: { blockReason: "SAFETY" },
      })
    ).toBeNull();
    expect(
      extractInlineImage({
        candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }],
      })
    ).toBeNull();
    expect(extractInlineImage({ candidates: [] })).toBeNull();
  });
});

describe("/game winner portrait flow", () => {
  const restores = [];
  afterEach(() => {
    while (restores.length) restores.pop()();
  });

  test("posts the winner embed immediately and never waits on Gemini", async () => {
    let release;
    restores.push(
      stubPortrait(
        "generatePortraitImage",
        () =>
          new Promise((resolve) => {
            release = resolve;
          })
      )
    );

    await withHarness(
      {
        gameData: createActiveGame({ name: "Ankh" }),
        options: { subcommand: "winner", users: { player1: createUser() } },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        const run = runGame(harness);
        await run;
        expect(harness.calls.reply).toHaveLength(1);
        expect(harness.calls.reply[0].embeds[0].data.title).toContain("Alice");
        expect(harness.calls.editReply).toHaveLength(0);
        expect(harness.calls.followUp).toHaveLength(0);

        release(PNG_BYTES);
        await harness.client.lastWinnerPortraitWork;
        expect(harness.calls.editReply).toHaveLength(1);
        expect(harness.calls.editReply[0].files).toHaveLength(1);
        expect(harness.calls.editReply[0].embeds[0].data.image.url).toBe(
          "attachment://winner-portrait.png"
        );
      }
    );
  });

  test("forced Gemini errors still post the winner embed with no user-facing error", async () => {
    restores.push(
      stubPortrait("generatePortraitImage", async () => {
        throw new Error("SAFETY: image blocked");
      })
    );

    await withHarness(
      {
        gameData: createActiveGame({ name: "Ankh" }),
        options: { subcommand: "winner", users: { player1: createUser() } },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;

        expect(harness.calls.reply[0].embeds[0].data.title).toContain("Alice");
        expect(harness.calls.reply[0].flags).not.toBe(MessageFlags.Ephemeral);
        expect(harness.calls.followUp).toHaveLength(0);
        expect(harness.calls.editReply).toHaveLength(0);
        expect(collectedReplyText(harness).toLowerCase()).not.toContain("error");
        expect((await harness.getSavedGame()).winner).toEqual(["user-1"]);
        expect((await harness.getSavedGame()).winnerPortrait == null).toBe(true);
      }
    );
  });

  test("portrait:false skips generation", async () => {
    let generated = 0;
    restores.push(
      stubPortrait("generatePortraitImage", async () => {
        generated += 1;
        return PNG_BYTES;
      })
    );

    await withHarness(
      {
        gameData: createActiveGame({ name: "Ankh" }),
        options: {
          subcommand: "winner",
          users: { player1: createUser() },
          booleans: { portrait: false },
        },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;
        expect(generated).toBe(0);
        expect(harness.calls.editReply).toHaveLength(0);
        expect(harness.calls.reply[0].embeds[0].data.title).toContain("Alice");
      }
    );
  });

  test("reuses the stored portrait instead of calling Gemini for the same winners", async () => {
    let generated = 0;
    restores.push(
      stubPortrait("generatePortraitImage", async () => {
        generated += 1;
        return PNG_BYTES;
      })
    );
    restores.push(
      stubPortrait("fetchStoredPortraitBuffer", async () => Buffer.from("stored-png"))
    );

    await withHarness(
      {
        gameData: createActiveGame({
          name: "Ankh",
          winnerPortrait: {
            winnerUserIds: ["user-1"],
            channelId: "channel-1",
            messageId: "old-portrait",
          },
        }),
        options: { subcommand: "winner", users: { player1: createUser() } },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;
        expect(generated).toBe(0);
        expect(harness.calls.editReply[0].files).toHaveLength(1);
        const saved = await harness.getSavedGame();
        expect(saved.winnerPortrait.winnerUserIds).toEqual(["user-1"]);
        expect(saved.winnerPortrait.messageId).toBe("chat-1");
        expect(saved.winnerPortrait.url).toBeUndefined();
      }
    );
  });

  test("changes of winner regenerate instead of reusing", async () => {
    let generated = 0;
    restores.push(
      stubPortrait("generatePortraitImage", async () => {
        generated += 1;
        return PNG_BYTES;
      })
    );

    await withHarness(
      {
        gameData: createActiveGame({
          name: "Ankh",
          winnerPortrait: {
            winnerUserIds: ["user-2"],
            channelId: "channel-1",
            messageId: "old-portrait",
          },
        }),
        options: { subcommand: "winner", users: { player1: createUser() } },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;
        expect(generated).toBe(1);
      }
    );
  });

  test("more than 4 winners skip image generation", async () => {
    let generated = 0;
    restores.push(
      stubPortrait("generatePortraitImage", async () => {
        generated += 1;
        return PNG_BYTES;
      })
    );

    const extra = [2, 3, 4, 5].map((n) =>
      createUser({ id: `user-${n}`, username: `P${n}` })
    );
    await withHarness(
      {
        gameData: createActiveGame({
          name: "Ankh",
          players: [
            { userId: "user-1", name: "Alice", order: 0 },
            { userId: "user-2", name: "P2", order: 1 },
            { userId: "user-3", name: "P3", order: 2 },
            { userId: "user-4", name: "P4", order: 3 },
            { userId: "user-5", name: "P5", order: 4 },
          ],
        }),
        members: extra.map((user) => ({
          id: user.id,
          displayName: user.username,
          user,
        })),
        options: {
          subcommand: "winner",
          users: {
            player1: createUser(),
            player2: extra[0],
            player3: extra[1],
            player4: extra[2],
            player5: extra[3],
          },
        },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;
        expect(generated).toBe(0);
        expect((await harness.getSavedGame()).winner).toEqual([
          "user-1",
          "user-2",
          "user-3",
          "user-4",
          "user-5",
        ]);
        expect(harness.calls.reply[0].embeds).toHaveLength(1);
      }
    );
  });
});

describe("stored portrait refetch", () => {
  test("downloads attachment bytes from the stored channel and message id", async () => {
    const buffer = await WinnerPortrait.fetchStoredPortraitBuffer({
      portrait: { channelId: "channel-9", messageId: "msg-9" },
      gameChannel: {
        id: "channel-9",
        messages: {
          fetch: async (id) => ({
            id,
            attachments: [
              {
                name: "winner-portrait.png",
                url: "https://cdn.example/fresh-signed.png",
              },
            ],
          }),
        },
      },
      fetchImpl: async (url) => {
        expect(url).toBe("https://cdn.example/fresh-signed.png");
        return {
          ok: true,
          arrayBuffer: async () => PNG_BYTES,
        };
      },
    });
    expect(Buffer.from(buffer).equals(PNG_BYTES)).toBe(true);
  });

  test("GameWinner embed is unchanged when no portrait is applied", async () => {
    const embed = await GameFormatter.GameWinner(
      { name: "Ankh", winner: "user-1" },
      {
        id: "guild-1",
        members: { cache: { get: () => ({ displayName: "Alice" }) } },
      }
    );
    expect(embed.data.image).toBeUndefined();
    expect(embed.data.description).toBe("For winning Ankh");
  });
});
