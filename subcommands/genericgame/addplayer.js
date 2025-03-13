const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class AddPlayer {
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

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        await interaction.editReply(
            await Formatter.createGameStatusReply(gameData, interaction.guild, {
                content: `Added ${newPlayer} to the game at position ${newOrder + 1}`
            })
        )
    }
}

module.exports = new AddPlayer() 