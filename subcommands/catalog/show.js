const {
  autocompleteTemplates,
  enabledLabel,
  formatCardEntry,
  migrateHintReply,
  openReadyCatalog,
  replyEphemeral,
  truncateWithMore,
} = require("./shared.js");

class CatalogShow {
  async execute(interaction) {
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
      const header = [
        `**${template.name}** (\`${template.id}\`)`,
        `Enabled: ${enabledLabel(template.enabled)}`,
        `Cards: ${count}`,
        "",
      ].join("\n");
      const cardLines = (template.cards || []).map(formatCardEntry);
      await replyEphemeral(
        interaction,
        truncateWithMore(cardLines, { header, joiner: "\n" })
      );
    } finally {
      catalog.close();
    }
  }
}

module.exports = new CatalogShow();
