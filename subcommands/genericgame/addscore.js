const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class AddScore {
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

        const targetPlayer = interaction.options.getUser('player')
        const score = interaction.options.getString('score')
        
        // Find the player in the game
        const player = find(gameData.players, { userId: targetPlayer.id })
        if (!player) {
            await interaction.editReply({ 
                content: `${targetPlayer} is not in this game!`, 
                ephemeral: true 
            })
            return
        }

        // Update the player's score
        player.score = score

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        await interaction.editReply(
            await Formatter.createGameStatusReply(gameData, interaction.guild, {
                content: `Set ${targetPlayer}'s score to: ${score}`
            })
        )
    }
}

module.exports = new AddScore() 