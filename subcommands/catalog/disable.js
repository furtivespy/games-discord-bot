const {
  autocompleteTemplates,
  migrateHintReply,
  openReadyCatalog,
  replyEphemeral,
} = require("./shared.js");

class CatalogDisable {
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
          autocompleteTemplates(
            catalog.listTemplates(),
            focused,
            (template) => Number(template.enabled) === 1
          )
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
      if (Number(template.enabled) === 0) {
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
