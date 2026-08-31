const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  runSuggestionRecoveryMigration,
} = require("../../db/migrateGameDocuments.js");

class Migrate extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "migrate",
      description: "Recover the game database and make suggestions global",
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

    if (this.client._gameDocumentsMigrationRunning) {
      return interaction.reply({
        content: "A migration is already running.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    this.client._gameDocumentsMigrationRunning = true;

    try {
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
    }
  }
}

module.exports = Migrate;
