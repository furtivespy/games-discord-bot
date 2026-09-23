const { afterEach, describe, expect, test } = require("bun:test");
const { ChannelType, MessageFlags } = require("discord.js");
const VisualLaunch = require("../modules/visualLaunch");

afterEach(() => {
  VisualLaunch.clearOrigins();
});

describe("visual launch origin store", () => {
  test("remembers and consumes a resolvable origin name", () => {
    expect(
      VisualLaunch.rememberOrigin("user-1", {
        originChannelId: "forum-1",
        channelName: "Inis Friday",
        hostChannelId: "table-1",
      })
    ).toBe(true);
    expect(VisualLaunch.consumeOrigin("user-1", { hostChannelId: "table-1" })).toEqual(
      expect.objectContaining({
        originChannelId: "forum-1",
        channelName: "Inis Friday",
        hostChannelId: "table-1",
      })
    );
    expect(VisualLaunch.peekOrigin("user-1")).toBeNull();
  });

  test("does not store a blank origin name", () => {
    expect(
      VisualLaunch.rememberOrigin("user-1", {
        channelName: "   ",
        hostChannelId: "table-1",
      })
    ).toBe(false);
    expect(VisualLaunch.peekOrigin("user-1")).toBeNull();
  });

  test("does not consume when the Activity host channel does not match", () => {
    VisualLaunch.rememberOrigin("user-1", {
      channelName: "Inis Friday",
      hostChannelId: "table-1",
    });
    expect(
      VisualLaunch.consumeOrigin("user-1", { hostChannelId: "other-table" })
    ).toBeNull();
    expect(VisualLaunch.peekOrigin("user-1").channelName).toBe("Inis Friday");
  });

  test("expires leftover origin records", () => {
    const now = 1_000;
    VisualLaunch.rememberOrigin(
      "user-1",
      { channelName: "Inis Friday", hostChannelId: "table-1" },
      now
    );
    expect(
      VisualLaunch.consumeOrigin("user-1", {
        hostChannelId: "table-1",
        now: now + VisualLaunch.ORIGIN_TTL_MS + 1,
      })
    ).toBeNull();
  });
});

describe("visual launch channel gates", () => {
  test("blocks forum parents and forum post threads", async () => {
    expect(
      await VisualLaunch.channelBlocksActivities({
        type: ChannelType.GuildForum,
        name: "games",
      })
    ).toBe(true);
    expect(
      await VisualLaunch.channelBlocksActivities({
        type: ChannelType.PublicThread,
        name: "Inis Friday",
        isThread: () => true,
        parent: { type: ChannelType.GuildForum, name: "games" },
      })
    ).toBe(true);
    expect(
      await VisualLaunch.channelBlocksActivities({
        type: ChannelType.GuildText,
        name: "game-table",
      })
    ).toBe(false);
  });

  test("omits an unresolvable channel name", () => {
    expect(VisualLaunch.channelDisplayName({})).toBeNull();
    expect(VisualLaunch.channelDisplayName({ name: "   " })).toBeNull();
    expect(VisualLaunch.channelDisplayName({ name: "Inis Friday" })).toBe(
      "Inis Friday"
    );
  });
});

describe("visual Open visual button", () => {
  test("parses origin channel id from custom_id", () => {
    const customId = VisualLaunch.openVisualCustomId("123456789012345678");
    expect(VisualLaunch.isVisualButton(customId)).toBe(true);
    expect(VisualLaunch.parseVisualButton(customId)).toEqual({
      action: VisualLaunch.OPEN_ACTION,
      originChannelId: "123456789012345678",
    });
    expect(VisualLaunch.parseVisualButton("gather:very:abc")).toBeNull();
  });

  test("launches the Activity and remembers the origin channel name", async () => {
    const launches = [];
    const replies = [];
    const origin = {
      id: "forum-thread-1",
      name: "Inis Friday",
      type: ChannelType.PublicThread,
    };
    const interaction = {
      customId: VisualLaunch.openVisualCustomId(origin.id),
      channelId: "table-1",
      user: { id: "user-1" },
      channel: { id: "table-1", type: ChannelType.GuildText, name: "game-table" },
      replied: false,
      deferred: false,
      launchActivity: async () => {
        launches.push(true);
      },
      reply: async (payload) => {
        replies.push(payload);
      },
    };
    const client = {
      channels: {
        cache: { get: (id) => (id === origin.id ? origin : null) },
      },
      logger: { log: () => {} },
    };

    await VisualLaunch.handleButton(interaction, client);
    expect(launches).toEqual([true]);
    expect(replies).toEqual([]);
    expect(VisualLaunch.peekOrigin("user-1")).toEqual(
      expect.objectContaining({
        channelName: "Inis Friday",
        hostChannelId: "table-1",
      })
    );
  });

  test("does not launch from a forum and does not invent an origin name", async () => {
    const launches = [];
    const replies = [];
    const interaction = {
      customId: VisualLaunch.openVisualCustomId("forum-thread-1"),
      channelId: "forum-thread-1",
      user: { id: "user-1" },
      channel: {
        id: "forum-thread-1",
        type: ChannelType.PublicThread,
        name: "Inis Friday",
        isThread: () => true,
        parent: { type: ChannelType.GuildForum, name: "games" },
      },
      replied: false,
      deferred: false,
      launchActivity: async () => {
        launches.push(true);
      },
      reply: async (payload) => {
        replies.push(payload);
        interaction.replied = true;
      },
    };

    await VisualLaunch.handleButton(interaction, { logger: { log: () => {} } });
    expect(launches).toEqual([]);
    expect(replies[0].content).toBe(VisualLaunch.FORUM_BLOCKED_MESSAGE);
    expect(replies[0].flags).toBe(MessageFlags.Ephemeral);
    expect(VisualLaunch.peekOrigin("user-1")).toBeNull();
  });

  test("omits origin when the source channel name cannot be resolved", async () => {
    const launches = [];
    const interaction = {
      customId: VisualLaunch.openVisualCustomId("missing-channel"),
      channelId: "table-1",
      user: { id: "user-1" },
      channel: { id: "table-1", type: ChannelType.GuildText },
      launchActivity: async () => {
        launches.push(true);
      },
      reply: async () => {},
    };
    await VisualLaunch.handleButton(interaction, {
      channels: { cache: { get: () => null } },
    });
    expect(launches).toEqual([true]);
    expect(VisualLaunch.peekOrigin("user-1")).toBeNull();
  });
});
