const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

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

        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        const discardedByDeck = {}
        const remaining = []

        for (const card of gameData.gameBoard) {
            const deck = find(gameData.decks, {name: card.origin})
            if (deck && deck.piles && deck.piles.discard) {
                deck.piles.discard.cards.push(card)
                discardedByDeck[deck.name] = (discardedByDeck[deck.name] || 0) + 1
            } else {
                remaining.push(card)
            }
        }

        const discardedCount = gameData.gameBoard.length - remaining.length
        gameData.gameBoard = remaining

        if (discardedCount === 0) {
            await interaction.editReply({
                content: `Could not move Game Board cards to discard piles.`
            })
            return
        }

        const cardWord = discardedCount === 1 ? 'card' : 'cards'
        const content = `${actorDisplayName} cleared the Game Board (${discardedCount} ${cardWord} moved to discard piles)`

        try {
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.GAME,
                GameDB.ACTION_TYPES.MODIFY,
                `${actorDisplayName} cleared Game Board (${discardedCount} ${cardWord} to discard)`,
                {
                    source: 'gameboard',
                    cardCount: discardedCount,
                    discardedByDeck: discardedByDeck
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record game board clear in history:', error)
        }

        // Skip pin refresh on this save so Discord ACK is not blocked on pin
        // image/API work. sendPublicStatusUpdate updates the pin after editReply.
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData, {
            skipPinnedRefresh: true
        })

        try {
            await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
                content,
                resolveDeferredReply: true
            })
        } catch (error) {
            console.error('Failed to send game board clear status update:', error)
            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({ content })
                }
            } catch (replyError) {
                console.error('Failed to resolve game board clear interaction:', replyError)
            }
        }
    }
}

module.exports = new GameBoardClear()
