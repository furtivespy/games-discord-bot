const GameHelper = require('../../modules/GlobalGameHelper')
const { find } = require('lodash')
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
        
        const data = await Formatter.GameStatusV2(gameData, interaction.guild)

        await interaction.editReply({ 
            content: `Set ${targetPlayer}'s score to: ${score}`,
            embeds: gameData.decks.length > 0 ? [...Formatter.deckStatus2(gameData)] : [],
            files: [...data]
        })
    }
}

module.exports = new AddScore() 