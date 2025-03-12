const { EmbedBuilder } = require('discord.js')
const { find } = require('lodash')
const GameDB = require('../../db/anygame')

class Add {
    static async execute(interaction, client) {
        const gameData = await GameDB.get(interaction.channel.id)
        if (!gameData) {
            return await interaction.reply({ content: "No game in progress!", ephemeral: true })
        }

        const name = interaction.options.getString('name')
        const secret = interaction.options.getBoolean('secret') || false
        const description = interaction.options.getString('description') || ''

        // Initialize tokens array if it doesn't exist
        if (!gameData.tokens) {
            gameData.tokens = []
        }

        // Check if token already exists
        if (find(gameData.tokens, { name })) {
            return await interaction.reply({ content: `Token "${name}" already exists!`, ephemeral: true })
        }

        // Add new token type
        gameData.tokens.push({
            name,
            secret,
            description
        })

        // Save game data
        await GameDB.set(interaction.channel.id, gameData)

        const embed = new EmbedBuilder()
            .setTitle('Token Added')
            .setDescription(`Added new token type: ${name}`)
            .addFields(
                { name: 'Secret', value: secret ? 'Yes' : 'No', inline: true },
                { name: 'Description', value: description || 'No description', inline: true }
            )
            .setColor('#00FF00')

        await interaction.reply({ embeds: [embed] })
    }
}

module.exports = Add 