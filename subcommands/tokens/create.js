const { MessageFlags } = require("discord.js");
const { nanoid } = require('nanoid')
const GameDB = require('../../db/anygame')
const GameHelper = require('../../modules/GlobalGameHelper')

class Add {
    static async execute(interaction, client) {
        const gameData = Object.assign(
            {},
            GameDB.defaultGameData,
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        )

        if (gameData.isdeleted) {
            return await interaction.reply({ content: "No game in progress!", flags: MessageFlags.Ephemeral })
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
            return await interaction.reply({ content: `A token named "${name}" already exists!`, flags: MessageFlags.Ephemeral })
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

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.TOKEN,
                GameDB.ACTION_TYPES.CREATE,
                `${actorDisplayName} created ${token.isSecret ? 'secret ' : ''}token type: ${token.name}`,
                {
                    tokenId: token.id,
                    tokenName: token.name,
                    isSecret: token.isSecret,
                    description: token.description,
                    cap: token.cap
                }
            )
        } catch (error) {
            console.warn('Failed to record token creation in history:', error)
        }

        // Save game data
        await client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData)

        return await interaction.reply({ 
            content: `Added new ${token.isSecret ? 'secret ' : ''}token: ${token.name}${token.description ? ` - ${token.description}` : ''}${token.cap !== null ? ` (Cap: ${token.cap})` : ''}`})
    }
}

module.exports = Add 