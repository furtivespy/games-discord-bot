const { EmbedBuilder } = require('discord.js')
const { find } = require('lodash')
const GameDB = require('../../db/anygame')

class Lose {
    static async execute(interaction, client) {
        const gameData = await GameDB.get(interaction.channel.id)
        if (!gameData) {
            return await interaction.reply({ content: "No game in progress!", ephemeral: true })
        }

        const name = interaction.options.getString('name')
        const amount = interaction.options.getInteger('amount')

        if (amount <= 0) {
            return await interaction.reply({ content: "Amount must be positive!", ephemeral: true })
        }

        // Check if token exists
        const token = find(gameData.tokens, { name })
        if (!token) {
            return await interaction.reply({ content: `Token "${name}" not found!`, ephemeral: true })
        }

        // Find player
        const player = find(gameData.players, { userId: interaction.user.id })
        if (!player) {
            return await interaction.reply({ content: "You're not in this game!", ephemeral: true })
        }

        // Check if player has enough tokens
        const currentAmount = player.tokens?.[name] || 0
        if (currentAmount < amount) {
            return await interaction.reply({ 
                content: `You don't have enough ${name} tokens! You only have ${currentAmount}.`,
                ephemeral: true 
            })
        }

        // Initialize player's tokens if needed
        if (!player.tokens) {
            player.tokens = {}
        }

        // Remove tokens
        player.tokens[name] = currentAmount - amount

        // Save game data
        await GameDB.set(interaction.channel.id, gameData)

        const embed = new EmbedBuilder()
            .setTitle('Tokens Lost')
            .setDescription(`You lost ${amount} ${name} token(s)`)
            .addFields(
                { name: 'New Total', value: player.tokens[name].toString(), inline: true }
            )
            .setColor('#FF0000')

        // If token is secret, reply ephemeral
        await interaction.reply({ 
            embeds: [embed],
            ephemeral: token.secret
        })
    }
}

module.exports = Lose 