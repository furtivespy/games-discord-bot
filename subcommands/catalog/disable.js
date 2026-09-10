const {
  autocompleteTemplates,
  catalogUnavailableReply,
  isTemplateEnabled,
  openReadyCatalog,
  replyEphemeral,
} = require("./shared.js");

class CatalogDisable {
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
            isTemplateEnabled
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
      if (!isTemplateEnabled(template)) {
        await replyEphemeral(
          interaction,
          `\`${template.id}\` (${template.name}) is already disabled.`
        );
        return;
      }

      catalog.setEnabled(id, 0);
      await replyEphemeral(
        interaction,
        [
          `Disabled \`${template.id}\` (${template.name}). Live games are unchanged.`,
          "Until catalog cutover (FUR-38), this does not affect `/cards` autocomplete (still JS).",
        ].join("\n")
      );
    } finally {
      catalog.close();
    }
  }
}

module.exports = new CatalogDisable();
