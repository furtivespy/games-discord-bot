const { SlashCommandBuilder } = require("@discordjs/builders");
const SlashCommand = require("../../base/SlashCommand.js");
const VisualLaunch = require("../../modules/visualLaunch");

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
    const fromForum = await VisualLaunch.channelBlocksActivities(
      interaction.channel,
      this.client
    );

    if (fromForum) {
      return VisualLaunch.replyEphemeral(
        interaction,
        VisualLaunch.FORUM_BLOCKED_MESSAGE
      );
    }

    const launched = await VisualLaunch.launchInPlace(interaction, {
      logger: this.client.logger,
    });
    if (launched) return;

    return VisualLaunch.replyEphemeral(
      interaction,
      VisualLaunch.LAUNCH_FALLBACK_MESSAGE
    );
  }
}

module.exports = Visual;
