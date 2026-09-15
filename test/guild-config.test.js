const { describe, expect, test } = require("bun:test");
const { ChannelType, MessageFlags, PermissionsBitField } = require("discord.js");
const GuildConfig = require("../modules/GuildConfig");
const Config = require("../slashcommands/util/config");

function settingsClient(initial = {}) {
  const store = { default: {}, guild: { ...initial } };
  return {
    logger: { log() {} },
    getSettings: (guild) => {
      if (!guild) return { ...store.default };
      return { ...store.default, ...store.guild };
    },
    writeSettings: (id, newSettings) => {
      store.guildId = id;
      Object.assign(store.guild, newSettings);
    },
    store,
  };
}

describe("GuildConfig LFG games parent", () => {
  test("treats empty, whitespace, and missing as unset", () => {
    const client = settingsClient();
    expect(GuildConfig.getLfgGameParentChannelId(client, { id: "g1" })).toBeNull();

    client.writeSettings("g1", { lfg_game_parent_channel_id: "   " });
    expect(GuildConfig.getLfgGameParentChannelId(client, { id: "g1" })).toBeNull();
  });

  test("accepts a raw snowflake or a channel mention", () => {
    const client = settingsClient();
    GuildConfig.setLfgGameParentChannelId(client, "g1", "<#123456789012345678>");
    expect(GuildConfig.getLfgGameParentChannelId(client, { id: "g1" })).toBe(
      "123456789012345678"
    );

    GuildConfig.setLfgGameParentChannelId(client, "g1", "games-channel");
    expect(GuildConfig.getLfgGameParentChannelId(client, { id: "g1" })).toBe(
      "games-channel"
    );
  });

  test("unset message tells admins to run /config games-channel", () => {
    expect(GuildConfig.unsetStartMessage()).toContain("/config games-channel");
  });
});

describe("/config command", () => {
  test("games-channel writes the guild setting", async () => {
    const client = settingsClient();
    const command = new Config(client);
    const replies = [];
    await command.execute({
      guildId: "guild-1",
      guild: { id: "guild-1" },
      memberPermissions: { has: (flag) => flag === PermissionsBitField.Flags.Administrator },
      options: {
        getSubcommand: () => "games-channel",
        getChannel: () => ({
          id: "games-99",
          type: ChannelType.GuildText,
        }),
      },
      reply: async (payload) => {
        replies.push(payload);
        return payload;
      },
    });
    expect(client.store.guild.lfg_game_parent_channel_id).toBe("games-99");
    expect(replies[0].content).toContain("<#games-99>");
    expect(replies[0].flags).toBe(MessageFlags.Ephemeral);
  });

  test("games-channel accepts a forum channel", async () => {
    const client = settingsClient();
    const command = new Config(client);
    const replies = [];
    await command.execute({
      guildId: "guild-1",
      guild: { id: "guild-1" },
      memberPermissions: { has: (flag) => flag === PermissionsBitField.Flags.Administrator },
      options: {
        getSubcommand: () => "games-channel",
        getChannel: () => ({
          id: "forum-42",
          type: ChannelType.GuildForum,
        }),
      },
      reply: async (payload) => {
        replies.push(payload);
        return payload;
      },
    });
    expect(client.store.guild.lfg_game_parent_channel_id).toBe("forum-42");
    expect(replies[0].content).toContain("<#forum-42>");
  });

  test("games-channel option lists forum alongside text channels", () => {
    const command = new Config(settingsClient());
    const json = command.data.toJSON();
    const games = json.options.find((option) => option.name === "games-channel");
    const channel = games.options.find((option) => option.name === "channel");
    expect(channel.channel_types).toEqual([
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildForum,
    ]);
  });

  test("show reports when the games channel is missing", async () => {
    const client = settingsClient();
    const command = new Config(client);
    const replies = [];
    await command.execute({
      guildId: "guild-1",
      guild: { id: "guild-1" },
      memberPermissions: { has: () => true },
      options: { getSubcommand: () => "show" },
      reply: async (payload) => replies.push(payload),
    });
    expect(replies[0].content).toContain("not set");
    expect(replies[0].content).toContain("/config games-channel");
  });

  test("rejects non-administrators", async () => {
    const client = settingsClient();
    const command = new Config(client);
    const replies = [];
    await command.execute({
      guildId: "guild-1",
      guild: { id: "guild-1" },
      memberPermissions: { has: () => false },
      options: { getSubcommand: () => "show" },
      reply: async (payload) => replies.push(payload),
    });
    expect(replies[0].content).toContain("administrators");
    expect(client.store.guild.lfg_game_parent_channel_id).toBeUndefined();
  });
});
