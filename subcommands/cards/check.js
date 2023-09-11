const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Check {
    async execute(interaction, client) {

        let gameData = await GameHelper.getGameData(client, interaction)

        if (interaction.isAutocomplete()) {
            await GameHelper.getDeckAutocomplete(gameData, interaction)
        } else {
            if (gameData.isdeleted) {
                await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
                return
            }

            const inputDeck = interaction.options.getString('deck')
            const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)
            if (!deck){
                await interaction.reply({ content: `No deck found.`, ephemeral: true })
                return
            } 

            await interaction.deferReply();
            let followup = await Formatter.multiCard(deck.piles.discard.cards, `All Discards in ${deck.name}`)

            await interaction.editReply({ 
                content: `${interaction.member.displayName} is looking at the ${deck.name} discard pile`,
            })

            await interaction.followUp({ embeds: [followup[0]], files: [followup[1]], ephemeral: true })

        }
    }
}

module.exports = new Check()
