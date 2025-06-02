const { nanoid } = require('nanoid')
const GameDB = require('../../db/anygame')

class Add {
    static async execute(interaction, client) {
        const gameData = Object.assign(
            {},
            GameDB.defaultGameData,
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        )

        if (gameData.isdeleted) {
            return await interaction.reply({ content: "No game in progress!", ephemeral: true })
        }

        const name = interaction.options.getString('name')
        const description = interaction.options.getString('description') || ''
        const isSecret = interaction.options.getBoolean('secret') || false
        const cap = interaction.options.getInteger('cap')

        // Initialize tokens array if it doesn't exist
        if (!gameData.tokens) {
            gameData.tokens = []
        }

        // Check if token with same name already exists
        if (gameData.tokens.some(t => t.name === name)) {
            return await interaction.reply({ content: `A token named "${name}" already exists!`, ephemeral: true })
        }

        // Create new token
        const token = {
            id: nanoid(),
            name,
            description,
            isSecret,
            cap: typeof cap === 'number' ? cap : null,
            created: new Date().toISOString(),
            createdBy: interaction.user.id
        }

        // Add token to game
        gameData.tokens.push(token)

        // Save game data
        await client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData)

        return await interaction.reply({ 
            content: `Added new ${token.isSecret ? 'secret ' : ''}token: ${token.name}${token.description ? ` - ${token.description}` : ''}${token.cap !== null ? ` (Cap: ${token.cap})` : ''}`,
            ephemeral: false
        })
    }
}

module.exports = Add 