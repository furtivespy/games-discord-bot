const { EmbedBuilder } = require('discord.js')
const { find } = require('lodash')
const GameDB = require('../../db/anygame')

class Gain {
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

        // Initialize player's tokens if needed
        if (!player.tokens) {
            player.tokens = {}
        }

        // Add tokens
        player.tokens[name] = (player.tokens[name] || 0) + amount

        // Save game data
        await GameDB.set(interaction.channel.id, gameData)

        const embed = new EmbedBuilder()
            .setTitle('Tokens Gained')
            .setDescription(`You gained ${amount} ${name} token(s)`)
            .addFields(
                { name: 'New Total', value: player.tokens[name].toString(), inline: true }
            )
            .setColor('#00FF00')

        // If token is secret, reply ephemeral
        await interaction.reply({ 
            embeds: [embed],
            ephemeral: token.secret
        })
    }
}

module.exports = Gain 