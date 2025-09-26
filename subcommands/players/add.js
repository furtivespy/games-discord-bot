const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class Add {
    async execute(interaction, client) {
        await interaction.deferReply()

        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({
                content: `No active game in this channel`,
                ephemeral: true
            })
            return
        }

        const newPlayer = interaction.options.getUser('player')

        // Check if player is already in the game
        if (find(gameData.players, { userId: newPlayer.id })) {
            await interaction.editReply({
                content: `${newPlayer} is already in this game!`,
                ephemeral: true
            })
            return
        }

        // Add the new player at the end of the turn order
        const newOrder = gameData.players.length
        gameData.players.push(
            Object.assign(
                {},
                cloneDeep(GameDB.defaultPlayer),
                {
                    guildId: interaction.guild.id,
                    userId: newPlayer.id,
                    order: newOrder,
                    name: newPlayer.username
                }
            )
        )

        // Record this action in game history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const addedDisplayName = interaction.guild.members.cache.get(newPlayer.id)?.displayName || newPlayer.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.PLAYER,
                GameDB.ACTION_TYPES.ADD,
                `${actorDisplayName} added ${addedDisplayName} to the game at position ${newOrder + 1}`,
                {
                    addedPlayer: {
                        userId: newPlayer.id,
                        username: newPlayer.username
                    },
                    position: newOrder + 1
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record player add action in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
            content: `Added ${newPlayer} to the game at position ${newOrder + 1}`
        })
    }
}

module.exports = new Add()