const { EmbedBuilder } = require('discord.js')
const { find } = require('lodash')
const GameDB = require('../../db/anygame')

class Give {
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
        const targetUser = interaction.options.getUser('player')

        // Check if tokens exist
        if (!gameData.tokens || !gameData.tokens.length) {
            return await interaction.reply({ content: "No tokens exist in this game!", ephemeral: true })
        }

        // Find the token
        const token = find(gameData.tokens, { name })
        if (!token) {
            return await interaction.reply({ content: `Token "${name}" not found!`, ephemeral: true })
        }

        // Find the source player (command user)
        const sourcePlayer = find(gameData.players, { userId: interaction.user.id })
        if (!sourcePlayer) {
            return await interaction.reply({ content: "You're not in this game!", ephemeral: true })
        }

        // Find the target player
        const targetPlayer = find(gameData.players, { userId: targetUser.id })
        if (!targetPlayer) {
            return await interaction.reply({ content: `${targetUser} is not in this game!`, ephemeral: true })
        }

        // Initialize tokens objects if they don't exist
        if (!sourcePlayer.tokens) sourcePlayer.tokens = {}
        if (!targetPlayer.tokens) targetPlayer.tokens = {}

        // Check if source player has enough tokens
        const sourceCount = sourcePlayer.tokens[token.id] || 0
        if (sourceCount < amount) {
            return await interaction.reply({ 
                content: `You don't have enough ${name} tokens! You have ${sourceCount}.`,
                ephemeral: true 
            })
        }

        // Transfer tokens
        sourcePlayer.tokens[token.id] = sourceCount - amount
        targetPlayer.tokens[token.id] = (targetPlayer.tokens[token.id] || 0) + amount

        // Save game data
        await client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData)

        // Get display names
        const sourceDisplay = interaction.guild.members.cache.get(sourcePlayer.userId)?.displayName ?? sourcePlayer.name ?? sourcePlayer.userId
        const targetDisplay = interaction.guild.members.cache.get(targetPlayer.userId)?.displayName ?? targetPlayer.name ?? targetPlayer.userId

        return await interaction.reply({ 
            content: `${sourceDisplay} gave ${amount} ${name} token(s) to ${targetDisplay}`,
            ephemeral: false
        })
    }
}

module.exports = Give 