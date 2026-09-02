const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { seedDeckCatalog } = require("../../db/seedDeckCatalog.js");

// /migrate is intentionally single-purpose: one Bot Owner job at a time.
// Do not add a job picker or unrelated migrations here unless explicitly
// specified; use a dedicated command or script for one-off recovery work.

class Migrate extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "migrate",
      description:
        "Seed built-in deck templates into deck_catalog.sqlite (idempotent, insert-if-absent)",
      permLevel: "Bot Owner",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .setDMPermission(false);
  }

  async execute(interaction) {
    if (interaction.user.id !== this.client.config.botOwnerId) {
      return interaction.reply({
        content: "You do not have permission to use this command. (Bot Owner Only)",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (this.client._deckCatalogMigrationRunning) {
      return interaction.reply({
        content: "A migration is already running.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    this.client._deckCatalogMigrationRunning = true;

    try {
      const result = seedDeckCatalog();
      await interaction.editReply({
        content: [
          "Deck catalog seed complete.",
          `Templates inserted: ${result.inserted}`,
          `Templates skipped (already present): ${result.skipped}`,
          `Total rows: ${result.total}`,
        ].join("\n"),
      });
    } catch (error) {
      this.client.logger.log(error, "error");
      await interaction.editReply({
        content: `Migration failed: ${error.message}`,
      });
    } finally {
      this.client._deckCatalogMigrationRunning = false;
    }
  }
}

module.exports = Migrate;
