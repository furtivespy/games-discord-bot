const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class AddScore {
    async execute(interaction, client) {
        await interaction.deferReply()

        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ 
                content: `No active game in this channel`})
            return
        }

        const targetPlayer = interaction.options.getUser('player') || interaction.user
        const score = interaction.options.getString('score')
        
        // Find the player in the game
        const player = find(gameData.players, { userId: targetPlayer.id })
        if (!player) {
            await interaction.editReply({ 
                content: `${targetPlayer} is not in this game!`})
            return
        }

        // Update the player's score
        const oldScore = player.score
        player.score = score

        // Record this action in game history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const targetDisplayName = interaction.guild.members.cache.get(targetPlayer.id)?.displayName || targetPlayer.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.PLAYER,
                GameDB.ACTION_TYPES.SCORE,
                `${actorDisplayName} set ${targetDisplayName}'s score to ${score}${oldScore ? ` (was ${oldScore})` : ''}`,
                {
                    targetPlayer: {
                        userId: targetPlayer.id,
                        username: targetPlayer.username
                    },
                    oldScore: oldScore,
                    newScore: score
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record score change action in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
            content: `Set ${targetPlayer}'s score to: ${score}`
        })
    }
}

module.exports = new AddScore()