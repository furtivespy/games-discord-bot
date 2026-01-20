const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const Formatter = require('../../modules/GameFormatter')

class Flip {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true)
            let gameData = await GameHelper.getGameData(client, interaction)
            
            if (focusedOption.name === 'deck') {
                await GameHelper.getDeckAutocomplete(gameData, interaction)
            } else if (focusedOption.name === 'pilename') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedOption.value))
            }
            return
        }

        await interaction.deferReply()
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const inputDeck = interaction.options.getString('deck')
        const destination = interaction.options.getString('destination') || 'discard'
        const pileId = interaction.options.getString('pilename')
        
        const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)

        if (!deck || deck.piles.draw.cards.length < 1){
            await interaction.editReply({ content: "No cards in draw pile", ephemeral: true })
            return
        } 

        const theCard = deck.piles.draw.cards.shift()
        let destinationName = ''

        // Handle different destinations
        if (destination === 'pile') {
            const pile = GameHelper.getGlobalPile(gameData, pileId)
            if (!pile) {
                // Return card to deck if pile not found
                deck.piles.draw.cards.unshift(theCard)
                await interaction.editReply({ content: 'Pile not found!', ephemeral: true })
                return
            }
            pile.cards.push(theCard)
            destinationName = pile.name
        } else if (destination === 'gameboard') {
            if (!gameData.gameBoard) {
                gameData.gameBoard = []
            }
            gameData.gameBoard.push(theCard)
            destinationName = 'Game Board'
        } else {
            // Default to discard
            deck.piles.discard.cards.push(theCard)
            destinationName = `${deck.name} discard pile`
        }
        
        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardName = Formatter.cardShortName(theCard)
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.FLIP,
                `${actorDisplayName} flipped ${cardName} from ${deck.name} to ${destinationName}`,
                {
                    cardId: theCard.id,
                    cardName: cardName,
                    deckName: deck.name,
                    source: "draw pile",
                    destination: destinationName,
                    destinationType: destination
                }
            )
        } catch (error) {
            console.warn('Failed to record card flip in history:', error)
        }
        
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await interaction.editReply({ 
            content: `Flipped from the top of ${deck.name} to ${destinationName}`, 
            embeds: [Formatter.oneCard(theCard)]
        })
    }
}

module.exports = new Flip()