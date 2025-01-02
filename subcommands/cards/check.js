const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const Formatter = require('../../modules/GameFormatter')

class Check {
    async execute(interaction, client) {

        
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
        } else {
            await interaction.deferReply()

            let gameData = await GameHelper.getGameData(client, interaction)
            if (gameData.isdeleted) {
                await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
                return
            }

            const inputDeck = interaction.options.getString('deck')
            const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)
            if (!deck){
                await interaction.editReply({ content: `No deck found.`, ephemeral: true })
                return
            } 

            let followup = await Formatter.multiCard(deck.piles.discard.cards, `All Discards in ${deck.name}`)

            await interaction.editReply({ 
                content: `${interaction.member.displayName} is looking at the ${deck.name} discard pile`
            })

            await interaction.followUp({ embeds: [...followup[0]], files: [...followup[1]], ephemeral: true })
        }
    }
}

module.exports = new Check()
