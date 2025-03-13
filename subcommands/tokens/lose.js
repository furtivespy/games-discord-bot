const { find } = require('lodash')
const GameDB = require('../../db/anygame')

class Lose {
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
        const amount = interaction.options.getInteger('amount') || 1

        // Check if tokens exist
        if (!gameData.tokens || !gameData.tokens.length) {
            return await interaction.reply({ content: "No tokens exist in this game!", ephemeral: true })
        }

        // Find the token
        const token = find(gameData.tokens, { name })
        if (!token) {
            return await interaction.reply({ content: `Token "${name}" not found!`, ephemeral: true })
        }

        // Find the player
        const player = find(gameData.players, { userId: interaction.user.id })
        if (!player) {
            return await interaction.reply({ content: "You're not in this game!", ephemeral: true })
        }

        // Initialize tokens object if it doesn't exist
        if (!player.tokens) player.tokens = {}

        // Check if player has enough tokens
        const currentAmount = player.tokens[token.id] || 0
        if (currentAmount < amount) {
            return await interaction.reply({ 
                content: `You don't have enough ${name} tokens! You have ${currentAmount}.`,
                ephemeral: true 
            })
        }

        // Remove tokens
        player.tokens[token.id] = currentAmount - amount

        // Save game data
        await client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData)

        // Get display name
        const displayName = interaction.guild.members.cache.get(player.userId)?.displayName ?? player.name ?? player.userId

        return await interaction.reply({ 
            content: `${displayName} lost ${amount} ${name} token(s)`,
            ephemeral: false
        })
    }
}

module.exports = Lose 