const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

function cardLabel(count) {
    return count === 1 ? 'card' : 'cards'
}

class GameBoardClear {
    async execute(interaction, client) {
        const [, gameData] = await Promise.all([
            interaction.deferReply(),
            GameHelper.getGameData(client, interaction)
        ])

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        if (!gameData.gameBoard || gameData.gameBoard.length === 0) {
            await interaction.editReply({ content: `The Game Board is already empty.`})
            return
        }

        const cardCount = gameData.gameBoard.length
        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        const content = `${actorDisplayName} cleared the Game Board (${cardCount} ${cardLabel(cardCount)} moved to discard piles)`

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
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.GAME,
                GameDB.ACTION_TYPES.MODIFY,
                `${actorDisplayName} cleared Game Board (${cardCount} ${cardLabel(cardCount)} to discard)`,
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

        // Resolve the deferred slash reply with this status. Without
        // resolveDeferredReply, Discord is left on "thinking..." / "The
        // application did not respond" while a disconnected channel message
        // posts the success text (FUR-97).
        try {
            await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
                content,
                resolveDeferredReply: true
            })
        } catch (error) {
            console.error('Failed to send game board clear status update:', error)
            if (!interaction.replied) {
                await interaction.editReply({ content })
            }
        }
    }
}

module.exports = new GameBoardClear()
