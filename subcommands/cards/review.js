const { MessageFlags } = require("discord.js");
const GameHelper = require('../../modules/GlobalGameHelper')
const { find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Review {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
            return
        }

        await interaction.deferReply()
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        const inputDeck = interaction.options.getString('deck')
        const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)
        if (!deck){
            await interaction.editReply({ content: `No deck found.`})
            return
        } 
        
        let followup = await Formatter.multiCard(deck.allCards, `All cards in ${deck.name}`)

        await interaction.editReply({ 
            content: `${interaction.member.displayName} is reviewing the total makeup of ${deck.name}`})
        
        await interaction.followUp({ embeds: [...followup[0]], files: [...followup[1]], flags: MessageFlags.Ephemeral })
    }
}

module.exports = new Review()
