const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find, findIndex } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class RemovePlayer {
    async execute(interaction, client) {
        await interaction.deferReply()

        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ 
                content: `No active game in this channel`})
            return
        }

        const playerToRemove = interaction.options.getUser('player')
        
        // Find the player in the game
        const player = find(gameData.players, { userId: playerToRemove.id })
        if (!player) {
            await interaction.editReply({ 
                content: `${playerToRemove} is not in this game!`})
            return
        }
        const removedPlayerName = interaction.guild.members.cache.get(player.userId)?.displayName || player.name;
        const discardedCardCount = player.hands.main.length;

        // Discard all cards from player's hand
        if (player.hands.main.length > 0) {
            for (const card of player.hands.main) {
                const deck = find(gameData.decks, {name: card.origin})
                if (deck) {
                    deck.piles.discard.cards.push(card)
                }
            }
            player.hands.main = []
        }

        // Remove player and reorder remaining players
        const playerIndex = findIndex(gameData.players, { userId: playerToRemove.id })
        gameData.players.splice(playerIndex, 1)
        
        // Update order numbers for remaining players
        for (let i = 0; i < gameData.players.length; i++) {
            gameData.players[i].order = i
        }

        // Record history for removing a player
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username;

            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.PLAYER,
                GameDB.ACTION_TYPES.REMOVE,
                `${actorDisplayName} removed ${removedPlayerName} from the game.`,
                {
                    removedUserId: playerToRemove.id,
                    removedUsername: removedPlayerName,
                    discardedCardCount: discardedCardCount
                }
            );
        } catch (error) {
            console.warn('Failed to record remove player in history:', error);
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
            content: `Removed ${playerToRemove} from the game and discarded their cards`
        })
    }
}

module.exports = new RemovePlayer()