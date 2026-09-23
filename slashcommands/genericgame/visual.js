const { ChannelType } = require("discord.js");
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
      .setDMPermission(false)
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription(
            "Text channel to post an Open visual button (forum/bridge)"
          )
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement
          )
          .setRequired(false)
      );
  }

  async execute(interaction) {
    const target = interaction.options.getChannel("channel");
    const originChannel = interaction.channel;
    const originName = VisualLaunch.channelDisplayName(originChannel);
    const fromForum = await VisualLaunch.channelBlocksActivities(
      originChannel,
      this.client
    );

    if (target) {
      if (!VisualLaunch.canPostBridgeButton(target)) {
        return VisualLaunch.replyEphemeral(
          interaction,
          "That channel can't host an Open visual button. Pick a normal text channel."
        );
      }
      try {
        await VisualLaunch.postOpenVisualMessage(target, {
          originChannelId: interaction.channelId,
          originChannelName: originName,
        });
      } catch (error) {
        this.client.logger.log(error, "error");
        return VisualLaunch.replyEphemeral(
          interaction,
          "Could not post an Open visual button in that channel. I need permission to send messages there."
        );
      }
      return VisualLaunch.replyEphemeral(
        interaction,
        VisualLaunch.bridgePostedMessage({
          targetChannelId: target.id,
          originChannelName: originName,
          fromForum,
        })
      );
    }

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
