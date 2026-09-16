const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  autocompleteTopics,
  replyHelp,
} = require("../../modules/helpCatalog.js");

class Help extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "help",
      description: "Discover Game Bot commands and how-tos (decks, tables, LFG)",
      usage: "/help | /help topic:decks",
      enabled: true,
      permLevel: "User",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .addStringOption((option) =>
        option
          .setName("topic")
          .setDescription("Jump to a how-to or area (e.g. decks, session, lfg)")
          .setRequired(false)
          .setAutocomplete(true)
      );
  }

  async execute(interaction) {
    try {
      if (interaction.isAutocomplete()) {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== "topic") {
          await interaction.respond([]);
          return;
        }
        await interaction.respond(autocompleteTopics(focused.value));
        return;
      }

      await replyHelp(interaction, this.client, {
        topicId: interaction.options.getString("topic"),
      });
    } catch (e) {
      this.client.logger.log(e, "error");
      const fallback = {
        content: "Something went wrong showing help. Try `/help` again.",
        flags: MessageFlags.Ephemeral,
      };
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(fallback);
        } else {
          await interaction.reply(fallback);
        }
      } catch (_) {}
    }
  }
}

module.exports = Help;
