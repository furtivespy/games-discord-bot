const {
  embedsFromLines,
  formatTemplateListLine,
  migrateHintReply,
  openReadyCatalog,
  replyEphemeral,
  replyEphemeralEmbeds,
  resolveCreatorNames,
} = require("./shared.js");

class CatalogList {
  async execute(interaction, client) {
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

      const creatorNames = await resolveCreatorNames(
        client || interaction.client,
        templates.map((template) => template.created_by)
      );
      const enabled = templates.filter((template) => Number(template.enabled) === 1);
      const disabled = templates.filter((template) => Number(template.enabled) !== 1);
      const lineFor = (template) =>
        formatTemplateListLine(template, { creatorNames });

      const embeds = [
        ...embedsFromLines({
          title: `Enabled (${enabled.length})`,
          lines: enabled.map(lineFor),
          emptyText: "None",
        }),
        ...embedsFromLines({
          title: `Disabled (${disabled.length})`,
          lines: disabled.map(lineFor),
          emptyText: "None",
        }),
      ];
      await replyEphemeralEmbeds(interaction, embeds);
    } finally {
      catalog.close();
    }
  }
}

module.exports = new CatalogList();
