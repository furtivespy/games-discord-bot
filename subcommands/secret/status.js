const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Status {
    async execute(interaction, client) {
        let secretData = Object.assign(
            {},
            cloneDeep(GameDB.defaultSecretData), 
            await client.getGameDataV2(interaction.guildId, 'secret', interaction.channelId)
        )

        // Get game data for player count
        let gameData = null
        try {
            gameData = await GameHelper.getGameData(client, interaction)
        } catch (error) {
            // Game data might not exist, that's okay
        }

        const isSuperSecret = secretData.mode === 'super-secret'

        if (isSuperSecret) {
            // In super-secret mode, just show count
            const secretCount = secretData.players.filter(p => p.hassecret).length
            // Get total players from game data if secret players list is empty
            const totalPlayers = secretData.players.length > 0 
                ? secretData.players.length 
                : (gameData && gameData.players ? gameData.players.length : 0)
            
            await interaction.reply({ 
                content: `🤐 **Super Secret Status:**\n${secretCount} of ${totalPlayers} players have entered secrets`})
        } else {
            // In normal mode, show full status
            await interaction.reply({ 
                content: `Secret Status:`,
                embeds: [await Formatter.SecretStatus(secretData, interaction.guild, gameData)]
            })
        }
    }
}

module.exports = new Status()

