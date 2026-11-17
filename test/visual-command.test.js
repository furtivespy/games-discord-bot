const { afterEach, describe, expect, test } = require("bun:test");
const { ChannelType, Collection, MessageFlags } = require("discord.js");
const Visual = require("../slashcommands/genericgame/visual");
const VisualLaunch = require("../modules/visualLaunch");
const {
  DISCORD_LAUNCH_ACTIVITY,
  PRIMARY_ENTRY_POINT_TYPE,
  buildApplicationCommandPayload,
  primaryEntryPointCommand,
  putApplicationCommands,
  registerApplicationCommands,
} = require("../modules/applicationCommands");
const { withHarness } = require("./helpers/harness");

afterEach(() => {
  VisualLaunch.clearOrigins();
});

describe("/visual", () => {
  test("is a guild-only chat command with no options", () => {
    const command = new Visual({ logger: { log: () => {} }, config: {} });
    expect(command.conf.permLevel).toBe("User");
    const json = command.data.toJSON();
    expect(json.name).toBe("visual");
    expect(json.dm_permission).toBe(false);
    expect(json.options ?? []).toHaveLength(0);
  });

  test("launches the Embedded App and does not send a chat reply", async () => {
    await withHarness({}, async (harness) => {
      const launches = [];
      harness.interaction.launchActivity = async () => {
        launches.push(true);
      };
      await new Visual(harness.client).execute(harness.interaction);
      expect(launches).toEqual([true]);
      expect(harness.calls.reply).toEqual([]);
      expect(harness.calls.followUp).toEqual([]);
    });
  });

  test("falls back to the App Launcher when launchActivity is missing", async () => {
    await withHarness({}, async (harness) => {
      await new Visual(harness.client).execute(harness.interaction);
      expect(harness.lastContent()).toContain("App Launcher");
      expect(harness.calls.reply[0].flags).toBe(MessageFlags.Ephemeral);
    });
  });

  test("falls back to the App Launcher when launchActivity throws", async () => {
    await withHarness({}, async (harness) => {
      harness.interaction.launchActivity = async () => {
        throw new Error("Activities are not enabled");
      };
      await new Visual(harness.client).execute(harness.interaction);
      expect(harness.lastContent()).toContain("App Launcher");
      expect(harness.calls.reply[0].flags).toBe(MessageFlags.Ephemeral);
    });
  });

  test("in-place launch does not remember an origin channel", async () => {
    await withHarness({}, async (harness) => {
      VisualLaunch.rememberOrigin(harness.user.id, {
        channelName: "should-be-cleared",
        hostChannelId: harness.channel.id,
      });
      harness.interaction.launchActivity = async () => {};
      await new Visual(harness.client).execute(harness.interaction);
      expect(VisualLaunch.peekOrigin(harness.user.id)).toBeNull();
    });
  });

  test("refuses to launch in a forum post", async () => {
    await withHarness({ channelName: "Inis Friday" }, async (harness) => {
      const launches = [];
      harness.channel.type = ChannelType.PublicThread;
      harness.channel.parent = {
        id: "forum-1",
        type: ChannelType.GuildForum,
        name: "games",
      };
      harness.channel.isThread = () => true;
      harness.interaction.launchActivity = async () => {
        launches.push(true);
      };
      await new Visual(harness.client).execute(harness.interaction);
      expect(launches).toEqual([]);
      expect(harness.lastContent()).toBe(VisualLaunch.FORUM_BLOCKED_MESSAGE);
      expect(harness.calls.reply[0].flags).toBe(MessageFlags.Ephemeral);
    });
  });

  test("a leftover channel option from a forum post does not post a bridge button", async () => {
    expect(VisualLaunch.FORUM_BLOCKED_MESSAGE).not.toMatch(/pass a text `channel`/i);

    await withHarness(
      { channelName: "Inis Friday", channelId: "forum-thread-1" },
      async (harness) => {
        const sent = [];
        const launches = [];
        harness.channel.type = ChannelType.PublicThread;
        harness.channel.parent = {
          id: "forum-1",
          type: ChannelType.GuildForum,
          name: "games",
        };
        harness.channel.isThread = () => true;
        harness.interaction.launchActivity = async () => {
          launches.push(true);
        };
        harness.interaction.options.getChannel = (name) =>
          name === "channel"
            ? {
                id: "table-99",
                name: "game-table",
                type: ChannelType.GuildText,
                send: async (payload) => {
                  sent.push(payload);
                  return { id: "bridge-1" };
                },
              }
            : null;

        await new Visual(harness.client).execute(harness.interaction);

        expect(launches).toEqual([]);
        expect(sent).toEqual([]);
        expect(harness.lastContent()).toBe(VisualLaunch.FORUM_BLOCKED_MESSAGE);
        expect(harness.calls.reply[0].flags).toBe(MessageFlags.Ephemeral);
      }
    );
  });
});

describe("application command payload", () => {
  test("keeps the Activity Launch entry point so PUT does not wipe the launcher", () => {
    const slashcommands = new Collection();
    slashcommands.set(
      "visual",
      new Visual({ logger: { log: () => {} }, config: {} })
    );

    const payload = buildApplicationCommandPayload(slashcommands);
    const names = payload.map((command) => command.name);
    expect(names).toContain("visual");
    expect(payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "launch",
          type: PRIMARY_ENTRY_POINT_TYPE,
          handler: DISCORD_LAUNCH_ACTIVITY,
        }),
      ])
    );
    expect(primaryEntryPointCommand().type).toBe(4);
    expect(primaryEntryPointCommand().handler).toBe(2);
  });

  test("retries without the Launch entry point if Discord rejects type 4", async () => {
    const slashcommands = new Collection();
    slashcommands.set(
      "visual",
      new Visual({ logger: { log: () => {} }, config: {} })
    );
    const bodies = [];
    const rest = {
      put: async (_route, { body }) => {
        bodies.push(body);
        if (body.some((command) => command.type === 4)) {
          throw new Error("Invalid application command type");
        }
        return [];
      },
    };
    const logs = [];
    const result = await putApplicationCommands({
      rest,
      route: "/commands",
      slashcommands,
      logger: { log: (message) => logs.push(String(message)), error: () => {} },
    });
    expect(result.usedLaunchEntryPoint).toBe(false);
    expect(bodies).toHaveLength(2);
    expect(bodies[0].some((command) => command.type === 4)).toBe(true);
    expect(bodies[1].some((command) => command.type === 4)).toBe(false);
    expect(bodies[1].map((command) => command.name)).toContain("visual");
    expect(logs.join("\n")).toContain("retrying without it");
  });

  test("does not wipe the Launch entry point on rate limits", async () => {
    const slashcommands = new Collection();
    slashcommands.set(
      "visual",
      new Visual({ logger: { log: () => {} }, config: {} })
    );
    let puts = 0;
    const rest = {
      put: async () => {
        puts += 1;
        const error = new Error("You are being rate limited.");
        error.status = 429;
        throw error;
      },
    };
    await expect(
      putApplicationCommands({
        rest,
        route: "/commands",
        slashcommands,
        logger: { log: () => {}, error: () => {} },
      })
    ).rejects.toThrow(/rate limited/);
    expect(puts).toBe(1);
  });
});

describe("application command registration", () => {
  const DEV_CLIENT_ID = "548570412959662080";
  const DEV_GUILD_ID = "545109131330191371";

  function visualCommands() {
    const slashcommands = new Collection();
    slashcommands.set(
      "visual",
      new Visual({ logger: { log: () => {} }, config: {} })
    );
    return slashcommands;
  }

  function recordingRest() {
    const calls = [];
    const rest = {
      put: async (route, { body }) => {
        if (
          String(route).includes("/guilds/") &&
          body.some((command) => command.type === 4)
        ) {
          const error = new Error(
            "PRIMARY_ENTRY_POINT app commands must be registered as global commands."
          );
          error.code = 50222;
          error.status = 400;
          throw error;
        }
        calls.push({ route, body });
        return [];
      },
    };
    return { calls, rest };
  }

  test("dev mode puts slash commands on the guild and Launch on the global route", async () => {
    const { calls, rest } = recordingRest();
    const result = await registerApplicationCommands({
      rest,
      clientId: DEV_CLIENT_ID,
      slashcommands: visualCommands(),
      logger: { log: () => {}, error: () => {} },
    });

    expect(result.usedLaunchEntryPoint).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].route).toBe(
      `/applications/${DEV_CLIENT_ID}/guilds/${DEV_GUILD_ID}/commands`
    );
    expect(calls[0].body.map((command) => command.name)).toContain("visual");
    expect(calls[0].body.some((command) => command.type === 4)).toBe(false);
    expect(calls[1].route).toBe(`/applications/${DEV_CLIENT_ID}/commands`);
    expect(calls[1].body).toEqual([
      {
        name: "launch",
        type: 4,
        handler: 2,
      },
    ]);
  });

  test("non-dev mode puts slash commands and Launch in one global request", async () => {
    const { calls, rest } = recordingRest();
    const clientId = "999000111222333444";
    const result = await registerApplicationCommands({
      rest,
      clientId,
      slashcommands: visualCommands(),
      logger: { log: () => {}, error: () => {} },
    });

    expect(result.usedLaunchEntryPoint).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].route).toBe(`/applications/${clientId}/commands`);
    expect(calls[0].body.map((command) => command.name)).toEqual(
      expect.arrayContaining(["visual", "launch"])
    );
    expect(calls[0].body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "launch",
          type: PRIMARY_ENTRY_POINT_TYPE,
          handler: DISCORD_LAUNCH_ACTIVITY,
        }),
      ])
    );
  });
});
