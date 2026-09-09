const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const BoardGameGeek = require("../../modules/BoardGameGeek");
const GatherInterest = require("../../modules/GatherInterest");

class Lfg extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "lfg",
      description: "Look up a game on BGG and open a Who's interested? panel.",
      usage: "Use /lfg with a game name to post BGG info and an interest panel",
      enabled: true,
      permLevel: "User",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .addStringOption((option) =>
        option
          .setName("game")
          .setDescription("The game to propose (autocomplete or BGG id — same lookup as /bgg and /game newgame)")
          .setAutocomplete(true)
          .setRequired(true)
      );
  }

  async execute(interaction) {
    try {
      const search = interaction.options.getString("game");
      if (interaction.isAutocomplete()) {
        if (!search) {
          await interaction.respond([]);
          return;
        }
        await interaction.respond(
          await BoardGameGeek.Search(search, this.client.config.BGGToken)
        );
        return;
      }

      if (!interaction.guildId) {
        await interaction.reply({
          content: "Use /lfg in a server channel.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!search || isNaN(search)) {
        await interaction.reply({
          content: "Please choose from the available options",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const [, bgg] = await Promise.all([
        interaction.deferReply(),
        BoardGameGeek.CreateAndLoad(search, this.client, interaction),
      ]);
      await bgg.LoadEmbeds(BoardGameGeek.DetailsEnum.ALL);

      const gather = GatherInterest.createGather({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        hostUserId: interaction.user.id,
        hostDisplayName: interaction.member?.displayName || interaction.user.username,
        game: GatherInterest.snapshotFromBgg(bgg),
      });
      // Persist before buttons are visible so a fast click still finds the gather after a restart-safe write.
      await GatherInterest.saveGather(this.client, gather);

      const gameMessage = await interaction.editReply({
        embeds: bgg.embeds,
        files: bgg.attachments,
      });
      gather.gameMessageId = gameMessage?.id || null;

      const panelMessage = await interaction.followUp({
        ...GatherInterest.buildPanelPayload(gather),
      });
      gather.interestMessageId = panelMessage?.id || null;

      // Reload-and-merge under the gather lock so a click that already
      // confirmed is not overwritten by this in-memory object (empty interests).
      await GatherInterest.saveGatherAfterPost(this.client, gather);

      if (bgg.otherAttachments.length > 0) {
        await interaction.followUp({
          files: bgg.otherAttachments,
        });
      }
    } catch (e) {
      this.client.logger.log(e, "error");
      try {
        const reply = {
          content: "Something went wrong looking up that game. Please try again.",
          flags: MessageFlags.Ephemeral,
        };
        if (interaction.deferred || interaction.replied) await interaction.editReply(reply);
        else await interaction.reply(reply);
      } catch (_) {}
    }
  }
}

module.exports = Lfg;
