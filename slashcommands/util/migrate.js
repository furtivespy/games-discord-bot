const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  runSuggestionRecoveryMigration,
} = require("../../db/migrateGameDocuments.js");
const { seedDeckCatalog } = require("../../db/seedDeckCatalog.js");

class Migrate extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "migrate",
      description: "Run a Bot Owner migration job",
      permLevel: "Bot Owner",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .setDMPermission(false)
      .addStringOption((option) =>
        option
          .setName("job")
          .setDescription("Which job to run (default: suggestions)")
          .setRequired(false)
          .addChoices(
            { name: "suggestions", value: "suggestions" },
            { name: "deck-catalog", value: "deck-catalog" }
          )
      );
  }

  async execute(interaction) {
    if (interaction.user.id !== this.client.config.botOwnerId) {
      return interaction.reply({
        content: "You do not have permission to use this command. (Bot Owner Only)",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (
      this.client._gameDocumentsMigrationRunning ||
      this.client._deckCatalogMigrationRunning
    ) {
      return interaction.reply({
        content: "A migration is already running.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    this.client._gameDocumentsMigrationRunning = true;
    this.client._deckCatalogMigrationRunning = true;

    try {
      const job = interaction.options.getString("job") ?? "suggestions";

      if (job === "deck-catalog") {
        const result = seedDeckCatalog();
        await interaction.editReply({
          content: [
            "Deck catalog seed complete.",
            `Templates inserted: ${result.inserted}`,
            `Templates skipped (already present): ${result.skipped}`,
            `Total rows: ${result.total}`,
          ].join("\n"),
        });
        return;
      }

      if (job !== "suggestions") {
        await interaction.editReply({
          content: `Unknown migration job: ${job}`,
        });
        return;
      }

      const result = runSuggestionRecoveryMigration({
        store: this.client.db,
      });

      const summary = result.summary;
      const content =
        summary.length > 1900
          ? `${summary.slice(0, 1897)}...`
          : summary;

      await interaction.editReply({ content: `\`\`\`\n${content}\n\`\`\`` });
    } catch (error) {
      this.client.logger.log(error, "error");
      await interaction.editReply({
        content: `Migration failed: ${error.message}`,
      });
    } finally {
      this.client._gameDocumentsMigrationRunning = false;
      this.client._deckCatalogMigrationRunning = false;
    }
  }
}

module.exports = Migrate;
