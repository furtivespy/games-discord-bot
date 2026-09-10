const {
  autocompleteTemplates,
  catalogUnavailableReply,
  isTemplateEnabled,
  openReadyCatalog,
  replyEphemeral,
} = require("./shared.js");

class CatalogEnable {
  async execute(interaction) {
    const { ready, catalog, info } = openReadyCatalog();
    if (interaction.isAutocomplete()) {
      try {
        if (!ready) {
          await interaction.respond([]);
          return;
        }
        const focused = interaction.options.getFocused();
        await interaction.respond(
          autocompleteTemplates(
            catalog.listTemplates(),
            focused,
            (template) => !isTemplateEnabled(template)
          )
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
      if (isTemplateEnabled(template)) {
        await replyEphemeral(
          interaction,
          `\`${template.id}\` (${template.name}) is already enabled.`
        );
        return;
      }

      catalog.setEnabled(id, 1);
      await replyEphemeral(
        interaction,
        `Enabled \`${template.id}\` (${template.name}). Live games are unchanged.`
      );
    } finally {
      catalog.close();
    }
  }
}

module.exports = new CatalogEnable();
