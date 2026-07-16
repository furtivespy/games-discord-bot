const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const Formatter = require('../../modules/GameFormatter')

class Check {
    async execute(interaction, client) {

        
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
        } else {
            const [, gameData] = await Promise.all([
                interaction.deferReply(),
                GameHelper.getGameData(client, interaction)
            ]);
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

            const [, followup] = await Promise.all([
                interaction.editReply({ 
                    content: `${interaction.member.displayName} is looking at the ${deck.name} discard pile`
                }),
                Formatter.multiCard(deck.piles.discard.cards, `All Discards in ${deck.name}`)
            ]);

            await interaction.followUp({ embeds: [...followup[0]], files: [...followup[1]], flags: MessageFlags.Ephemeral })
        }
    }
}

module.exports = new Check()
