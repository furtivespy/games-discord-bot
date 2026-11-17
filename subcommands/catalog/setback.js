const DeckBack = require("../../modules/DeckBack");
const { EmbedBuilder } = require("discord.js");
const { EMBED_COLOR } = require("../../modules/DiscordEmbeds");
const {
  autocompleteTemplates,
  catalogUnavailableReply,
  openReadyCatalog,
  replyEphemeral,
  replyEphemeralEmbeds,
} = require("./shared.js");

class CatalogSetBack {
  async execute(interaction, client) {
    const opened = openReadyCatalog();
    const { ready, catalog } = opened;

    if (interaction.isAutocomplete()) {
      try {
        if (!ready) {
          await interaction.respond([]);
          return;
        }
        const focused = interaction.options.getFocused();
        await interaction.respond(
          autocompleteTemplates(catalog.listTemplates(), focused)
        );
      } finally {
        catalog?.close();
      }
      return;
    }

    if (!ready) {
      return interaction.reply(catalogUnavailableReply(opened.info));
    }

    try {
      const id = interaction.options.getString("id");
      const template = catalog.getTemplate(id);
      if (!template) {
        await replyEphemeral(
          interaction,
          `No catalog template with id "${id}".`
        );
        return;
      }

      const parsed = DeckBack.parseBackUrlInput(
        interaction.options.getString("url")
      );
      if (!parsed.present) {
        await replyEphemeral(
          interaction,
          `\`${template.id}\` (${template.name}) deck back: ${DeckBack.describeBackUrl(template.backUrl)}. Pass url to set an image, or url:clear for the default.`
        );
        return;
      }
      if (parsed.error) {
        await replyEphemeral(interaction, parsed.error);
        return;
      }

      catalog.setBackUrl(id, parsed.backUrl);
      const updated = catalog.getTemplate(id);
      if (parsed.backUrl) {
        await replyEphemeralEmbeds(interaction, [
          new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle(`${updated.name} deck back`)
            .setDescription(
              `Set \`${updated.id}\` deck back. Live games are unchanged; new \`/cards deck new\` uses this back.`
            )
            .setImage(parsed.backUrl),
        ]);
        return;
      }

      await replyEphemeral(
        interaction,
        `Cleared \`${updated.id}\` (${updated.name}) deck back; new decks will use ${DeckBack.DEFAULT_LABEL}. Live games are unchanged.`
      );
    } finally {
      catalog.close();
    }
  }
}

module.exports = new CatalogSetBack();
