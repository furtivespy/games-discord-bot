const SlashCommand = require("../../base/SlashCommand.js");
const {SlashCommandBuilder, MessageFlags} = require("discord.js");
const { createGeminiAI } = require("../../modules/GoogleGemini.js");
const GameHelper = require("../../modules/GlobalGameHelper.js");
const BoardGameGeek = require('../../modules/BoardGameGeek')

class Rules extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "rules",
      description: "Ask questions about game rules using AI",
      usage: "Use this command to get AI-powered answers about game rules",
      enabled: true,
      permLevel: "User",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .addStringOption((option) =>
        option
          .setName("question")
          .setDescription("Your question about game rules")
          .setRequired(true)
      );
  }

  async execute(interaction) {
    try {
      const question = interaction.options.getString("question");
      
      // Defer reply since AI processing takes time
      await interaction.deferReply();

      // Try to get current game context for better AI responses
      let bggData = null;
      try {
        const gameData = await GameHelper.getGameData(this.client, interaction);
        if (gameData && gameData.bggGameId && !gameData.isdeleted) {
          bggData = await BoardGameGeek.CreateAndLoad(gameData.bggGameId, this.client, interaction)
        }
      } catch (e) {
        // Silently continue without game context if we can't get it
        this.client.logger.warn("Could not get game context for rules command", { error: e.message });
      }

      // Initialize Gemini AI and get response
      const geminiAI = createGeminiAI(this.client);
      const responseChunks = await geminiAI.answerRulesQuestion(question, bggData);

      // Send the first chunk as edit to deferred reply
      if (responseChunks.length > 0) {
        await interaction.editReply({ content: responseChunks[0] });

        // Send any additional chunks as follow-ups
        for (let i = 1; i < responseChunks.length; i++) {
          await interaction.followUp({ content: responseChunks[i] });
        }
      } else {
        await interaction.editReply({
          content: "I'm sorry, I couldn't generate a response to your question. Please try rephrasing your question."
        });
      }

    } catch (e) {
      this.client.logger.error(e, "Rules command error");
      
      // Handle error response
      const errorMessage = "I encountered an error while processing your question. Please try again later.";
      
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
      }
    }
  }
}

module.exports = Rules;