const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder } = require("discord.js");
const { cloneDeep } = require("lodash");

const defaultSuggestionsObject = {
  suggestions: [],
}

class Suggest extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "suggest",
      description: "Suggest a feature",
      usage: "suggest",
      enabled: true,
      permLevel: "User",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .addStringOption((option) =>
        option
          .setName("suggestion")
          .setDescription("Your suggestion")
      )
  }

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const suggestion = interaction.options.getString("suggestion");
      
      let suggestionData = Object.assign(
        {},
        cloneDeep(defaultSuggestionsObject),
        await this.client.getGameDataV2(interaction.guildId, 'suggest', "x")
      );

      if (suggestion && suggestion.length > 0){
        suggestionData.suggestions.push({
          user: interaction.member.displayName,
          suggestion: suggestion
        })
        await this.client.setGameDataV2(interaction.guildId, 'suggest', "x", suggestionData)
      }

      let suggestions = "Current Suggestions:\n"
      suggestions += suggestionData.suggestions.map(suggestion => {
        return `- ${suggestion.user}: ${suggestion.suggestion}\n`
      })

      let embedItem = {
        title: `Game Bot Suggestions`,
        description: suggestions,
        color: 4130114,
      };
      await interaction.editReply({ embeds: [embedItem], ephemeral: true });
    } catch (e) { 
      this.client.logger.log(e,'error')
    }
  }
      
}

module.exports = Suggest
  