const { describe, expect, test } = require("bun:test");
const { Collection, MessageFlags } = require("discord.js");
const Visual = require("../slashcommands/genericgame/visual");
const {
  DISCORD_LAUNCH_ACTIVITY,
  PRIMARY_ENTRY_POINT_TYPE,
  buildApplicationCommandPayload,
  primaryEntryPointCommand,
  putApplicationCommands,
} = require("../modules/applicationCommands");
const { withHarness } = require("./helpers/harness");

describe("/visual", () => {
  test("is a guild-only chat command with no options", () => {
    const command = new Visual({ logger: { log: () => {} }, config: {} });
    expect(command.conf.permLevel).toBe("User");
    const json = command.data.toJSON();
    expect(json.name).toBe("visual");
    expect(json.dm_permission).toBe(false);
    expect(json.options || []).toEqual([]);
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
