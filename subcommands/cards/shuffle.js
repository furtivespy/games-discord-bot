const GameHelper = require('../../modules/GlobalGameHelper')
const { shuffle } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Shuffle {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
            return
        }

        await interaction.deferReply()
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const inputDeck = interaction.options.getString('deck')
        const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)
        if (!deck || deck.piles.draw.cards.length + deck.piles.discard.cards.length < 1){
            await interaction.editReply({ content: `No Deck to shuffle.`, ephemeral: true })
            return
        } 

        this.DoShuffle(deck)

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await interaction.editReply({ 
            content: `Shuffled ${deck.name}`,
            embeds: [
                Formatter.deckStatus(deck),
            ]
        })
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