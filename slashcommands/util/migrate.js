const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  runGameDocumentsMigration,
} = require("../../db/migrateGameDocuments.js");

class Migrate extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "migrate",
      description: "Migrate Enmap and Mongo game data into game_documents SQLite",
      permLevel: "Bot Owner",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .setDMPermission(false)
      .addBooleanOption((option) =>
        option
          .setName("merge")
          .setDescription(
            "Merge into existing game_documents instead of replacing it"
          )
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("skip_mongo")
          .setDescription(
            "Skip importing from mongoConnectionString in config"
          )
          .setRequired(false)
      );
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

    const merge = interaction.options.getBoolean("merge") ?? false;
    const skipMongo = interaction.options.getBoolean("skip_mongo") ?? false;
    const mongoUri = this.client.config.mongoConnectionString || null;

    if (!skipMongo && !mongoUri) {
      return interaction.reply({
        content:
          "mongoConnectionString is missing from config. Add it or run with skip_mongo:true.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    this.client._gameDocumentsMigrationRunning = true;

    try {
      const result = await runGameDocumentsMigration({
        store: this.client.db,
        mode: merge ? "merge" : "replace",
        mongoUri: skipMongo ? null : mongoUri,
        skipMongo,
        guildHint: interaction.guildId,
        caches: {
          gamedata: this.client.gamedata,
          guilddata: this.client.guilddata,
        },
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
