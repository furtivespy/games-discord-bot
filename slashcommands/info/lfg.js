const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const BoardGameGeek = require("../../modules/BoardGameGeek");
const GameIdentity = require("../../modules/GameIdentity");
const GatherInterest = require("../../modules/GatherInterest");

class Lfg extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "lfg",
      description: "Open a Who's interested? panel for a BGG title or custom playtest.",
      usage: "Use /lfg with a BGG game or customname to post a Who's interested? panel",
      enabled: true,
      permLevel: "User",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .addStringOption((option) =>
        option
          .setName("game")
          .setDescription("BGG title (autocomplete). Skip this if using customname.")
          .setAutocomplete(true)
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("customname")
          .setDescription("Playtest name when the game is not on BoardGameGeek")
          .setRequired(false)
          .setMinLength(GameIdentity.CUSTOM_NAME_MIN_LENGTH)
          .setMaxLength(GameIdentity.CUSTOM_NAME_MAX_LENGTH)
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

      const identity = GameIdentity.resolveGameIdentity({
        game: search,
        customname: interaction.options.getString("customname"),
      });
      if (identity.error) {
        await interaction.reply({
          content: identity.error,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      let bgg = null;
      let gameReply;
      if (identity.kind === "custom") {
        await interaction.deferReply();
        gameReply = {
          embeds: [GatherInterest.buildCustomGameEmbed(identity.name)],
        };
      } else {
        [, bgg] = await Promise.all([
          interaction.deferReply(),
          BoardGameGeek.CreateAndLoad(identity.bggGameId, this.client, interaction),
        ]);
        await bgg.LoadEmbeds(BoardGameGeek.DetailsEnum.ALL);
        gameReply = {
          embeds: bgg.embeds,
          files: bgg.attachments,
        };
      }

      const gather = GatherInterest.createGather({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        hostUserId: interaction.user.id,
        hostDisplayName: interaction.member?.displayName || interaction.user.username,
        game:
          identity.kind === "custom"
            ? GatherInterest.snapshotFromCustom(identity.name)
            : GatherInterest.snapshotFromBgg(bgg),
      });
      // Persist before buttons are visible so a fast click still finds the gather after a restart-safe write.
      await GatherInterest.saveGather(this.client, gather);

      const gameMessage = await interaction.editReply(gameReply);
      gather.gameMessageId = gameMessage?.id || null;

      const panelMessage = await interaction.followUp({
        ...GatherInterest.buildPanelPayload(gather),
      });
      gather.interestMessageId = panelMessage?.id || null;

      // Reload-and-merge under the gather lock so a click that already
      // confirmed is not overwritten by this in-memory object (empty interests).
      await GatherInterest.saveGatherAfterPost(this.client, gather);

      if (bgg?.otherAttachments?.length > 0) {
        await interaction.followUp({
          files: bgg.otherAttachments,
        });
      }
    } catch (e) {
      this.client.logger.log(e, "error");
      try {
        const reply = {
          content: "Something went wrong posting that gather. Please try again.",
          flags: MessageFlags.Ephemeral,
        };
        if (interaction.deferred || interaction.replied) await interaction.editReply(reply);
        else await interaction.reply(reply);
      } catch (_) {}
    }
  }
}

module.exports = Lfg;
