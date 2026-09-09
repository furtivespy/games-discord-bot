const {
  formatTemplateSummary,
  migrateHintReply,
  openReadyCatalog,
  replyEphemeral,
} = require("./shared.js");

class CatalogList {
  async execute(interaction) {
    if (interaction.isAutocomplete()) {
      await interaction.respond([]);
      return;
    }

    const { ready, catalog } = openReadyCatalog();
    if (!ready) {
      return interaction.reply(migrateHintReply());
    }

    try {
      const templates = catalog.listTemplates();
      if (templates.length === 0) {
        await replyEphemeral(
          interaction,
          "No catalog templates found. Run `/migrate` with job `deck-catalog` first."
        );
        return;
      }

      const header = `Catalog templates (${templates.length}), sorted by name:\n`;
      const body = templates.map(formatTemplateSummary).join("\n");
      await replyEphemeral(interaction, `${header}${body}`);
    } finally {
      catalog.close();
    }
  }
}

module.exports = new CatalogList();
