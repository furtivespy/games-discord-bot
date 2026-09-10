const {
  autocompleteTemplates,
  buildCardListEmbeds,
  enabledHeading,
  formatHandCardLine,
  formatLayoutLabel,
  formatCreatorName,
  catalogUnavailableReply,
  openReadyCatalog,
  replyEphemeral,
  replyEphemeralEmbeds,
  resolveCreatorNames,
} = require("./shared.js");

class CatalogShow {
  async execute(interaction, client) {
    const { ready, catalog, info } = openReadyCatalog();
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
      return interaction.reply(catalogUnavailableReply(info));
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

      if (template.cardsError) {
        await replyEphemeral(
          interaction,
          `Catalog template \`${template.id}\` (${template.name}) has unreadable cards data and cannot be displayed.`
        );
        return;
      }

      const cards = Array.isArray(template.cards) ? template.cards : [];
      const count = cards.length;
      const creatorNames = await resolveCreatorNames(
        client || interaction.client,
        [template.created_by]
      );
      const creator = formatCreatorName(template.created_by, creatorNames);
      const header = [
        `\`${template.id}\``,
        enabledHeading(template.enabled),
        `${count} cards`,
        formatLayoutLabel(cards),
        creator ? `by ${creator}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      await replyEphemeralEmbeds(
        interaction,
        buildCardListEmbeds({
          title: template.name,
          header,
          cardLines: cards.map(formatHandCardLine),
        })
      );
    } finally {
      catalog.close();
    }
  }
}

module.exports = new CatalogShow();
