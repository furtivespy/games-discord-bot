const { MessageFlags } = require("discord.js");
const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder } = require("@discordjs/builders");

class Visual extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "visual",
      description: "Open Game Bot visual mode in this channel",
      usage: "visual",
      enabled: true,
      permLevel: "User",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .setDMPermission(false);
  }

  async execute(interaction) {
    try {
      if (typeof interaction.launchActivity === "function") {
        await interaction.launchActivity();
        return;
      }
    } catch (error) {
      this.client.logger.log(error, "error");
    }

    const payload = {
      content:
        "Could not open visual mode from this command. Use Discord's App Launcher and choose Game Bot (Launch) in this channel.",
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(payload);
    }
    return interaction.reply(payload);
  }
}

module.exports = Visual;
