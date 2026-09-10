const {
  autocompleteTemplates,
  buildCardListEmbeds,
  enabledHeading,
  formatHandCardLine,
  formatLayoutLabel,
  formatCreatorName,
  migrateHintReply,
  openReadyCatalog,
  replyEphemeral,
  replyEphemeralEmbeds,
  resolveCreatorNames,
} = require("./shared.js");

class CatalogShow {
  async execute(interaction, client) {
    const { ready, catalog } = openReadyCatalog();
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
      return interaction.reply(migrateHintReply());
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

      const count = Array.isArray(template.cards) ? template.cards.length : 0;
      const creatorNames = await resolveCreatorNames(
        client || interaction.client,
        [template.created_by]
      );
      const creator = formatCreatorName(template.created_by, creatorNames);
      const header = [
        `\`${template.id}\``,
        enabledHeading(template.enabled),
        `${count} cards`,
        formatLayoutLabel(template.cards),
        creator ? `by ${creator}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      await replyEphemeralEmbeds(
        interaction,
        buildCardListEmbeds({
          title: template.name,
          header,
          cardLines: (template.cards || []).map(formatHandCardLine),
        })
      );
    } finally {
      catalog.close();
    }
  }
}

module.exports = new CatalogShow();
