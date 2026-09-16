const SlashCommand = require("../../base/SlashCommand.js");
const {
  ChannelType,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
} = require("discord.js");
const GuildConfig = require("../../modules/GuildConfig");

class Config extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "config",
      description: "Configure Game Bot guild settings",
      usage: "/config games-channel",
      enabled: true,
      permLevel: "Administrator",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .setDMPermission(false)
      .addSubcommand((subcommand) =>
        subcommand
          .setName("games-channel")
          .setDescription(
            "Set the text or forum channel where /lfg Start game opens play threads"
          )
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription(
                "Text or forum channel for game threads (not the LFG channel)"
              )
              .addChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement,
                ChannelType.GuildForum
              )
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("show")
          .setDescription("Show current Game Bot guild settings")
      );
  }

  async execute(interaction) {
    try {
      if (!interaction.guildId) {
        await interaction.reply({
          content: "Use /config in a server.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({
          content: "Only server administrators can change Game Bot config.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      if (subcommand === "show") {
        const channelId = GuildConfig.getLfgGameParentChannelId(
          this.client,
          interaction.guild
        );
        const gamesLine = channelId
          ? `Games parent channel: <#${channelId}> (\`${channelId}\`)`
          : `Games parent channel: not set\n${GuildConfig.unsetStartMessage()}`;
        await interaction.reply({
          content: `**Game Bot guild settings**\n${gamesLine}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === "games-channel") {
        const channel = interaction.options.getChannel("channel");
        GuildConfig.setLfgGameParentChannelId(
          this.client,
          interaction.guildId,
          channel.id
        );
        await interaction.reply({
          content: `Games parent channel set to <#${channel.id}>. \`/lfg\` **Start game** will open play threads there — not in the LFG channel.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        content: "Unknown config option.",
        flags: MessageFlags.Ephemeral,
      });
    } catch (e) {
      this.client.logger.log(e, "error");
      const reply = {
        content: "Could not update guild settings. Please try again.",
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.deferred || interaction.replied) await interaction.editReply(reply);
      else await interaction.reply(reply);
    }
  }
}

module.exports = Config;
