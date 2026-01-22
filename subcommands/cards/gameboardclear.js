const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class GameBoardClear {
    async execute(interaction, client) {
        await interaction.deferReply()
        
        const gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        if (!gameData.gameBoard || gameData.gameBoard.length === 0) {
            await interaction.editReply({ content: `The Game Board is already empty.`, ephemeral: true })
            return
        }

        const cardCount = gameData.gameBoard.length

        // Move all cards to their respective discard piles
        let discardedByDeck = {}
        gameData.gameBoard.forEach(card => {
            let deck = find(gameData.decks, {name: card.origin})
            if (deck && deck.piles && deck.piles.discard) {
                deck.piles.discard.cards.push(card)
                discardedByDeck[deck.name] = (discardedByDeck[deck.name] || 0) + 1
            }
        })

        gameData.gameBoard = []

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.GAME,
                GameDB.ACTION_TYPES.MODIFY,
                `${actorDisplayName} cleared Game Board (${cardCount} cards to discard)`,
                {
                    source: 'gameboard',
                    cardCount: cardCount,
                    discardedByDeck: discardedByDeck
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record game board clear in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
            content: `${interaction.member.displayName} cleared the Game Board (${cardCount} cards moved to discard piles)`
        })
    }
}

module.exports = new GameBoardClear()
