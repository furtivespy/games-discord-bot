const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Flip {
    async execute(interaction, client) {

        let gameData = await GameHelper.getGameData(client, interaction)

        if (interaction.isAutocomplete()) {
            await GameHelper.getDeckAutocomplete(gameData, interaction)
        } else {
            await interaction.deferReply()
            const inputDeck = interaction.options.getString('deck')
            const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)

            if (!deck || deck.piles.draw.cards.length < 1){
                await interaction.editReply({ content: "No cards in draw pile", ephemeral: true })
                return
            } 

            const theCard = deck.piles.draw.cards.shift()
            deck.piles.discard.cards.push(theCard)
            //client.setGameData(`game-${interaction.channel.id}`, gameData)
            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

            await interaction.editReply({ 
                content: `Flipped from the top of ${deck.name}`, 
                embeds: [Formatter.oneCard(theCard)]
            })
        }
    }
}


module.exports = new Flip()