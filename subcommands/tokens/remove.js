const { EmbedBuilder } = require('discord.js')
const { find } = require('lodash')
const GameDB = require('../../db/anygame')
const GameHelper = require('../../modules/GlobalGameHelper')

class Remove {
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

        // Check if tokens exist
        if (!gameData.tokens || !gameData.tokens.length) {
            return await interaction.reply({ content: "No tokens exist in this game!", ephemeral: true })
        }

        // Find the token
        const tokenIndex = gameData.tokens.findIndex(t => t.name === name)
        if (tokenIndex === -1) {
            return await interaction.reply({ content: `Token "${name}" not found!`, ephemeral: true })
        }

        const token = gameData.tokens[tokenIndex]

        // Remove token from all players
        gameData.players.forEach(player => {
            if (player.tokens && player.tokens[token.id]) {
                delete player.tokens[token.id]
            }
        })

        // Remove token from game
        gameData.tokens.splice(tokenIndex, 1)

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.TOKEN,
                GameDB.ACTION_TYPES.REMOVE,
                `${actorDisplayName} removed ${token.isSecret ? 'secret ' : ''}token type: ${name}`,
                {
                    tokenId: token.id,
                    tokenName: name,
                    wasSecret: token.isSecret,
                    description: token.description,
                    cap: token.cap
                }
            )
        } catch (error) {
            console.warn('Failed to record token removal in history:', error)
        }

        // Save game data
        await client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData)

        const embed = new EmbedBuilder()
            .setTitle('Token Removed')
            .setDescription(`Removed token type: ${name}`)
            .addFields(
                { name: 'Was Secret', value: token.isSecret ? 'Yes' : 'No', inline: true }
            )
            .setColor('#FF0000')

        await interaction.reply({ embeds: [embed] })
    }
}

module.exports = Remove 