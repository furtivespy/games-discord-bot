const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, shuffle, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Shuffle {
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
            if (!deck || deck.piles.draw.cards.length + deck.piles.discard.cards.length < 1){
                await interaction.reply({ content: `No Deck to shuffle.`, ephemeral: true })
                return
            } 

            this.DoShuffle(deck)

            //client.setGameData(`game-${interaction.channel.id}`, gameData)
            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

            await interaction.reply({ 
                content: `Shuffled ${deck.name}`,
                embeds: [
                    Formatter.deckStatus(deck),
                ]
            })

        }
    }

    DoShuffle(deck){
        let shuffleCards = [...deck.piles.discard.cards]
        deck.piles.discard.cards = []

        switch (deck.shuffleStyle){
            case 'bag':
                shuffleCards = shuffleCards.concat(deck.piles.draw.cards)
                deck.piles.draw.cards = []
                break;
        }
        
        shuffleCards = shuffle(shuffleCards)
        deck.piles.draw.cards = deck.piles.draw.cards.concat(shuffleCards)
    }
}


module.exports = new Shuffle()