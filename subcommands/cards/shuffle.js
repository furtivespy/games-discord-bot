const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
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

        const cardCountBeforeShuffle = deck.piles.draw.cards.length + deck.piles.discard.cards.length
        this.DoShuffle(deck)

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.SHUFFLE,
                `${actorDisplayName} shuffled ${deck.name} (${cardCountBeforeShuffle} cards)`,
                {
                    deckName: deck.name,
                    cardCount: cardCountBeforeShuffle,
                    shuffleStyle: deck.shuffleStyle
                }
            )
        } catch (error) {
            console.warn('Failed to record deck shuffle in history:', error)
        }

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