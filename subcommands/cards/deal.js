const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameHelper = require('../../modules/GlobalGameHelper')
const Shuffle = require(`./shuffle`)

class Deal {
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
            const cardCount = interaction.options.getInteger('count')
            let dealCount = 0

            const deck = gameData.decks.length == 1 ? gameData.decks[0] : find(gameData.decks, {name: inputDeck})
            if (!deck || deck.piles.draw.cards.length + deck.piles.discard.cards.length < 1){
                await interaction.editReply({ content: `No cards to deal.`, ephemeral: true })
                return
            } 
            
            dealLoop:
            for (let i = 0; i < cardCount; i++) {
                for (const player of gameData.players) {
                    if (deck.piles.draw.cards.length < 1){
                        await Shuffle.execute(interaction, client)
                    } 

                    if (deck.piles.draw.cards.length + deck.piles.discard.cards.length < 1){
                        break dealLoop
                    }
                    const theCard = deck.piles.draw.cards.shift()
                    player.hands.main.push(theCard)
                    dealCount++
                }
            }

            //client.setGameData(`game-${interaction.channel.id}`, gameData)
            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)           

            await interaction.editReply(
                await Formatter.createGameStatusReply(gameData, interaction.guild,
                  { content: `Dealt out a total of ${dealCount} cards from ${deck.name}.` }
                )
              );
        }
    }
}


module.exports = new Deal()