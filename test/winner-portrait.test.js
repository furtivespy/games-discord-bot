const { describe, expect, test, afterEach } = require("bun:test");
const { MessageFlags } = require("discord.js");
const Game = require("../slashcommands/genericgame/game");
const GameFormatter = require("../modules/GameFormatter");
const WinnerPortrait = require("../modules/WinnerPortrait");
const WinShare = require("../slashcommands/genericgame/winshare");
const {
  createGeminiAI,
  extractInlineImage,
  resolveImageModel,
  withTimeout,
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

  test("omitted portrait option skips generation even when the guild setting defaults on", () => {
    for (const portraitOption of [undefined, null]) {
      expect(
        WinnerPortrait.decidePortraitAction({
          winnerIds: ["user-1"],
          portraitOption,
          guildEnabled: true,
          hasGeminiKey: true,
        })
      ).toEqual({ action: "skip", reason: "not-requested" });
    }
  });

  test("explicit portrait:true generates when the server kill switch is on", () => {
    const decision = WinnerPortrait.decidePortraitAction({
      winnerIds: ["user-1"],
      portraitOption: true,
      guildEnabled: true,
      hasGeminiKey: true,
    });
    expect(decision.action).toBe("generate");
  });

  test("missing-settings fallback (guildEnabled true) still requires portrait:true", () => {
    expect(
      WinnerPortrait.decidePortraitAction({
        winnerIds: ["user-1"],
        portraitOption: null,
        guildEnabled: true,
        hasGeminiKey: true,
      }).action
    ).toBe("skip");
    expect(
      WinnerPortrait.decidePortraitAction({
        winnerIds: ["user-1"],
        portraitOption: true,
        guildEnabled: true,
        hasGeminiKey: true,
      }).action
    ).toBe("generate");
  });

  test("reuses a stored portrait when portrait is omitted so a valid pointer is not cleared", () => {
    const decision = WinnerPortrait.decidePortraitAction({
      winnerIds: ["user-1"],
      existingPortrait: {
        winnerUserIds: ["user-1"],
        channelId: "channel-1",
        messageId: "msg-1",
      },
      portraitOption: null,
      guildEnabled: true,
      hasGeminiKey: true,
    });
    expect(decision.action).toBe("reuse");
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

  test("reuses a stored portrait even when portrait:false, because that only skips generation", () => {
    const decision = WinnerPortrait.decidePortraitAction({
      winnerIds: ["user-1"],
      existingPortrait: {
        winnerUserIds: ["user-1"],
        channelId: "channel-1",
        messageId: "msg-1",
      },
      portraitOption: false,
      guildEnabled: false,
      hasGeminiKey: true,
    });
    expect(decision.action).toBe("reuse");
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

  test("processResponse returns the extract-error string for a missing or empty candidate and does not throw", async () => {
    const gemini = createGeminiAI({
      config: { geminiKey: "test-key" },
      logger: { warn() {}, error() {} },
    });
    const missing = await gemini.processResponse({});
    expect(missing).toEqual(["Error: Could not extract AI response text."]);

    const emptyCandidates = await gemini.processResponse({ candidates: [] });
    expect(emptyCandidates).toEqual([
      "Error: Could not extract AI response text.",
    ]);

    const emptyParts = await gemini.processResponse({
      candidates: [{ content: { parts: [] } }],
    });
    expect(emptyParts).toEqual(["Error: Could not extract AI response text."]);

    const noTextParts = await gemini.processResponse({
      response: { candidates: [{ content: { parts: [{ inlineData: {} }] } }] },
    });
    expect(noTextParts).toEqual(["Error: Could not extract AI response text."]);
  });

  test("processResponse still extracts /rules text from a valid candidate", async () => {
    const gemini = createGeminiAI({
      config: { geminiKey: "test-key" },
      logger: { warn() {}, error() {} },
    });
    const chunks = await gemini.processResponse({
      candidates: [
        {
          content: {
            parts: [{ text: "Draw two cards. " }, { text: "Then discard one." }],
          },
        },
      ],
    });
    expect(chunks).toEqual(["Draw two cards. Then discard one."]);
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
        options: {
          subcommand: "winner",
          users: { player1: createUser() },
          booleans: { portrait: true },
        },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        const run = runGame(harness);
        await run;
        expect(harness.calls.deferReply).toHaveLength(1);
        expect(harness.calls.reply).toHaveLength(0);
        expect(harness.calls.editReply).toHaveLength(1);
        expect(harness.calls.editReply[0].embeds[0].data.title).toContain("Alice");
        expect(harness.calls.followUp).toHaveLength(0);

        release(PNG_BYTES);
        await harness.client.lastWinnerPortraitWork;
        expect(harness.calls.editReply).toHaveLength(2);
        expect(harness.calls.editReply[1].files).toHaveLength(1);
        expect(harness.calls.editReply[1].embeds[0].data.image.url).toBe(
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
        options: {
          subcommand: "winner",
          users: { player1: createUser() },
          booleans: { portrait: true },
        },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;

        expect(harness.calls.deferReply[0].flags).toBeUndefined();
        expect(harness.calls.reply).toHaveLength(0);
        expect(harness.calls.editReply).toHaveLength(1);
        expect(harness.calls.editReply[0].embeds[0].data.title).toContain("Alice");
        expect(harness.calls.editReply[0].flags).not.toBe(MessageFlags.Ephemeral);
        expect(harness.calls.followUp).toHaveLength(0);
        expect(collectedReplyText(harness).toLowerCase()).not.toContain("error");
        expect((await harness.getSavedGame()).winner).toEqual(["user-1"]);
        expect((await harness.getSavedGame()).winnerPortrait == null).toBe(true);
      }
    );
  });

  test("omitted portrait option posts the embed and does not call Gemini", async () => {
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
        options: { subcommand: "winner", users: { player1: createUser() } },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        expect(harness.client.getSettings).toBeUndefined();
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;
        expect(generated).toBe(0);
        expect(harness.calls.editReply).toHaveLength(1);
        expect(harness.calls.editReply[0].embeds[0].data.title).toContain("Alice");
        expect(harness.calls.followUp).toHaveLength(0);
        expect((await harness.getSavedGame()).winnerPortrait == null).toBe(true);
      }
    );
  });

  test("portrait:true generates a portrait", async () => {
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
          booleans: { portrait: true },
        },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;
        expect(generated).toBe(1);
        expect(harness.calls.editReply.at(-1).files).toHaveLength(1);
        expect((await harness.getSavedGame()).winnerPortrait.winnerUserIds).toEqual([
          "user-1",
        ]);
      }
    );
  });

  test("portrait:true with the server kill switch off skips Gemini quietly", async () => {
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
          booleans: { portrait: true },
        },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        harness.client.getSettings = () => ({ winner_portraits_enabled: "false" });
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;
        expect(generated).toBe(0);
        expect(harness.calls.editReply).toHaveLength(1);
        expect(harness.calls.followUp).toHaveLength(0);
        expect(collectedReplyText(harness).toLowerCase()).not.toContain("error");
        expect((await harness.getSavedGame()).winnerPortrait == null).toBe(true);
      }
    );
  });

  test("missing guild settings plus omitted portrait does not generate", async () => {
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
        options: { subcommand: "winner", users: { player1: createUser() } },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        harness.client.getSettings = () => ({});
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;
        expect(generated).toBe(0);
        expect(harness.calls.editReply).toHaveLength(1);
      }
    );
  });

  test("missing guild settings plus portrait:true still generates (server default on)", async () => {
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
          booleans: { portrait: true },
        },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        harness.client.getSettings = () => ({});
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;
        expect(generated).toBe(1);
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
        expect(harness.calls.editReply).toHaveLength(1);
        expect(harness.calls.editReply[0].embeds[0].data.title).toContain("Alice");
      }
    );
  });

  test("re-run without portrait reuses a stored portrait and does not clear it", async () => {
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
        expect(harness.calls.editReply[0].files).toBeUndefined();
        expect(harness.calls.editReply.at(-1).files).toHaveLength(1);
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
        options: {
          subcommand: "winner",
          users: { player1: createUser() },
          booleans: { portrait: true },
        },
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
          winnerPortrait: {
            winnerUserIds: ["user-1"],
            channelId: "channel-1",
            messageId: "old-portrait",
          },
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
        expect((await harness.getSavedGame()).winnerPortrait == null).toBe(true);
        expect(harness.calls.editReply[0].embeds).toHaveLength(1);
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

  test("findPortraitAttachment ignores unnamed attachments", () => {
    expect(
      WinnerPortrait.findPortraitAttachment({
        attachments: [{ name: "other.png", url: "https://cdn.example/other.png" }],
      })
    ).toBeNull();
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

describe("winner portrait races, fallbacks, and silent failures", () => {
  const restores = [];
  afterEach(() => {
    while (restores.length) restores.pop()();
  });

  test("winner change plus generate failure does not leak the old portrait", async () => {
    restores.push(
      stubPortrait("generatePortraitImage", async () => {
        throw new Error("SAFETY: image blocked");
      })
    );

    await withHarness(
      {
        gameData: createActiveGame({
          name: "Ankh",
          winnerPortrait: {
            winnerUserIds: ["user-2"],
            channelId: "channel-1",
            messageId: "alice-portrait",
          },
        }),
        options: {
          subcommand: "winner",
          users: { player1: createUser() },
          booleans: { portrait: true },
        },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;

        const saved = await harness.getSavedGame();
        expect(saved.winner).toEqual(["user-1"]);
        expect(saved.winnerPortrait == null).toBe(true);
        expect(harness.calls.editReply[0].embeds[0].data.title).toContain("Alice");
        expect(harness.calls.followUp).toHaveLength(0);
        expect(collectedReplyText(harness).toLowerCase()).not.toContain("error");
        expect(
          WinnerPortrait.canReusePortrait(saved.winnerPortrait, saved.winner)
        ).toBe(false);

        const origGetChannel = harness.interaction.options.getChannel;
        harness.interaction.options.getChannel = () => harness.channel;
        try {
          await new WinShare(harness.client).execute(harness.interaction);
        } finally {
          harness.interaction.options.getChannel = origGetChannel;
        }
        const share = harness.calls.editReply.at(-1);
        expect(share.embeds[0].data.image).toBeUndefined();
        expect(share.files).toBeUndefined();
        expect(harness.calls.reply).toHaveLength(0);
      }
    );
  });

  test("portrait:false after a winner change clears the previous pointer", async () => {
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
        expect((await harness.getSavedGame()).winnerPortrait == null).toBe(true);
      }
    );
  });

  test("missing stored portrait message clears the dangling pointer and regenerates", async () => {
    let generated = 0;
    restores.push(
      stubPortrait("fetchStoredPortraitBuffer", async () => {
        throw new Error("Unknown Message");
      })
    );
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
            winnerUserIds: ["user-1"],
            channelId: "channel-1",
            messageId: "deleted-msg",
          },
        }),
        options: {
          subcommand: "winner",
          users: { player1: createUser() },
          booleans: { portrait: true },
        },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;
        expect(generated).toBe(1);
        const saved = await harness.getSavedGame();
        expect(saved.winnerPortrait.winnerUserIds).toEqual(["user-1"]);
        expect(saved.winnerPortrait.messageId).toBe("chat-1");
        expect(harness.calls.editReply.at(-1).files).toHaveLength(1);
      }
    );
  });

  test("missing stored portrait without portrait:true clears the dangling pointer and does not regenerate", async () => {
    let generated = 0;
    restores.push(
      stubPortrait("fetchStoredPortraitBuffer", async () => {
        throw new Error("Unknown Message");
      })
    );
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
            winnerUserIds: ["user-1"],
            channelId: "channel-1",
            messageId: "deleted-msg",
          },
        }),
        options: { subcommand: "winner", users: { player1: createUser() } },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;
        expect(generated).toBe(0);
        expect((await harness.getSavedGame()).winnerPortrait == null).toBe(true);
        expect(harness.calls.editReply).toHaveLength(1);
      }
    );
  });

  test("persistPortraitRef no-ops when latest.winner no longer matches this job", async () => {
    await withHarness(
      {
        gameData: createActiveGame({
          name: "Ankh",
          winner: ["user-1"],
        }),
      },
      async (harness) => {
        const latest = await harness.getSavedGame();
        latest.winner = ["user-2"];
        await harness.client.setGameDataV2(
          harness.interaction.guildId,
          "game",
          harness.interaction.channelId,
          latest
        );

        await WinnerPortrait.persistPortraitRef(
          harness.client,
          harness.interaction,
          latest,
          ["user-1"],
          { id: "alice-msg", channelId: "channel-1" }
        );

        const saved = await harness.getSavedGame();
        expect(saved.winner).toEqual(["user-2"]);
        expect(saved.winnerPortrait == null).toBe(true);
      }
    );
  });

  test("persistPortraitRef aborts when a second winner write lands between load and persist", async () => {
    await withHarness(
      {
        gameData: createActiveGame({
          name: "Ankh",
          winner: ["user-1"],
        }),
      },
      async (harness) => {
        const originalGet = harness.client.getGameDataV2.bind(harness.client);
        let loads = 0;
        harness.client.getGameDataV2 = async (...args) => {
          const data = await originalGet(...args);
          loads += 1;
          if (loads === 1) {
            const concurrent = await originalGet(...args);
            concurrent.winner = ["user-2"];
            concurrent.name = "Bob-session";
            concurrent.winnerPortrait = {
              winnerUserIds: ["user-2"],
              channelId: "channel-1",
              messageId: "bob-msg",
            };
            await harness.client.setGameDataV2(
              harness.interaction.guildId,
              "game",
              harness.interaction.channelId,
              concurrent
            );
          }
          return data;
        };

        await WinnerPortrait.persistPortraitRef(
          harness.client,
          harness.interaction,
          await originalGet(
            harness.interaction.guildId,
            "game",
            harness.interaction.channelId
          ),
          ["user-1"],
          { id: "alice-msg", channelId: "channel-1" }
        );

        harness.client.getGameDataV2 = originalGet;
        const saved = await harness.getSavedGame();
        expect(saved.winner).toEqual(["user-2"]);
        expect(saved.name).toBe("Bob-session");
        expect(saved.winnerPortrait).toEqual({
          winnerUserIds: ["user-2"],
          channelId: "channel-1",
          messageId: "bob-msg",
        });
      }
    );
  });

  test("clearJobWinnerPortrait does not write a stale snapshot after a concurrent winner change", async () => {
    await withHarness(
      {
        gameData: createActiveGame({
          name: "Ankh",
          winner: ["user-1"],
          winnerPortrait: {
            winnerUserIds: ["user-1"],
            channelId: "channel-1",
            messageId: "alice-old",
          },
        }),
      },
      async (harness) => {
        const originalGet = harness.client.getGameDataV2.bind(harness.client);
        let loads = 0;
        harness.client.getGameDataV2 = async (...args) => {
          const data = await originalGet(...args);
          loads += 1;
          if (loads === 1) {
            const concurrent = await originalGet(...args);
            concurrent.winner = ["user-2"];
            concurrent.isdeleted = false;
            concurrent.winnerPortrait = {
              winnerUserIds: ["user-2"],
              channelId: "channel-1",
              messageId: "bob-msg",
            };
            await harness.client.setGameDataV2(
              harness.interaction.guildId,
              "game",
              harness.interaction.channelId,
              concurrent
            );
          }
          return data;
        };

        await WinnerPortrait.clearJobWinnerPortrait(
          harness.client,
          harness.interaction,
          ["user-1"],
          await originalGet(
            harness.interaction.guildId,
            "game",
            harness.interaction.channelId
          )
        );

        harness.client.getGameDataV2 = originalGet;
        const saved = await harness.getSavedGame();
        expect(saved.winner).toEqual(["user-2"]);
        expect(saved.winnerPortrait.messageId).toBe("bob-msg");
      }
    );
  });

  test("persistPortraitRef aborts when isdeleted flips between load and persist", async () => {
    await withHarness(
      {
        gameData: createActiveGame({
          name: "Ankh",
          winner: ["user-1"],
        }),
      },
      async (harness) => {
        const originalGet = harness.client.getGameDataV2.bind(harness.client);
        let loads = 0;
        harness.client.getGameDataV2 = async (...args) => {
          const data = await originalGet(...args);
          loads += 1;
          if (loads === 1) {
            const concurrent = await originalGet(...args);
            concurrent.isdeleted = true;
            concurrent.winner = ["user-1"];
            await harness.client.setGameDataV2(
              harness.interaction.guildId,
              "game",
              harness.interaction.channelId,
              concurrent
            );
          }
          return data;
        };

        await WinnerPortrait.persistPortraitRef(
          harness.client,
          harness.interaction,
          await originalGet(
            harness.interaction.guildId,
            "game",
            harness.interaction.channelId
          ),
          ["user-1"],
          { id: "alice-msg", channelId: "channel-1" }
        );

        harness.client.getGameDataV2 = originalGet;
        const saved = await harness.getSavedGame();
        expect(saved.isdeleted).toBe(true);
        expect(saved.winnerPortrait == null).toBe(true);
      }
    );
  });

  test("timeout path stays silent and does not persist a portrait", async () => {
    restores.push(
      stubPortrait("generatePortraitImage", async () => {
        throw new Error("Gemini image generation timed out");
      })
    );

    await withHarness(
      {
        gameData: createActiveGame({ name: "Ankh" }),
        options: {
          subcommand: "winner",
          users: { player1: createUser() },
          booleans: { portrait: true },
        },
      },
      async (harness) => {
        harness.client.config.geminiKey = "test-key";
        await runGame(harness);
        await harness.client.lastWinnerPortraitWork;

        expect(harness.calls.editReply).toHaveLength(1);
        expect(harness.calls.editReply[0].embeds[0].data.title).toContain("Alice");
        expect(harness.calls.followUp).toHaveLength(0);
        expect(collectedReplyText(harness).toLowerCase()).not.toContain("error");
        expect(collectedReplyText(harness).toLowerCase()).not.toContain("timed out");
        expect((await harness.getSavedGame()).winnerPortrait == null).toBe(true);
      }
    );
  });

  test("withTimeout swallows a late generateContent rejection", async () => {
    const lateErrors = [];
    const onUnhandled = (reason) => {
      lateErrors.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      let rejectLate;
      const hung = new Promise((_, reject) => {
        rejectLate = reject;
      });
      await expect(withTimeout(hung, 20, "timed out")).rejects.toThrow("timed out");
      rejectLate(new Error("late generateContent failure"));
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(lateErrors).toHaveLength(0);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  test("uses slash User avatar when members.fetch fails", async () => {
    const user = createUser({ id: "user-9", username: "Riley" });
    const fetchedUrls = [];
    const images = await WinnerPortrait.collectWinnerAvatars({
      client: { logger: { warn() {} } },
      guild: {
        members: {
          cache: { get: () => null },
          fetch: async () => {
            throw new Error("Unknown Member");
          },
        },
      },
      winnerIds: ["user-9"],
      usersById: { "user-9": user },
      fetchImpl: async (url) => {
        fetchedUrls.push(url);
        return {
          ok: true,
          headers: { get: () => "image/png" },
          arrayBuffer: async () => PNG_BYTES,
        };
      },
    });

    expect(fetchedUrls).toEqual([
      "https://cdn.discordapp.com/avatars/user-9/avatar.png?size=512",
    ]);
    expect(images).toHaveLength(1);
    expect(images[0].mimeType).toBe("image/png");
  });

  test("skips generation when fewer avatars load than winners", async () => {
    const user = createUser({ id: "user-1" });
    const result = await WinnerPortrait.generatePortraitImage({
      client: {
        config: { geminiKey: "test-key" },
        logger: { warn() {}, error() {} },
      },
      gameName: "Ankh",
      winnerIds: ["user-1", "user-2"],
      winnerUsers: { "user-1": user },
      guild: {
        members: {
          cache: { get: () => null },
          fetch: async () => {
            throw new Error("Unknown Member");
          },
        },
      },
      fetchImpl: async (url) => {
        if (String(url).includes("user-1")) {
          return {
            ok: true,
            headers: { get: () => "image/png" },
            arrayBuffer: async () => PNG_BYTES,
          };
        }
        throw new Error("avatar gone");
      },
    });
    expect(result).toBeNull();
  });
});
