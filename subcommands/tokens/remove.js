const { EmbedBuilder } = require('discord.js')
const { find } = require('lodash')
const GameDB = require('../../db/anygame')

class Remove {
    static async execute(interaction, client) {
        const gameData = await GameDB.get(interaction.channel.id)
        if (!gameData) {
            return await interaction.reply({ content: "No game in progress!", ephemeral: true })
        }

        const name = interaction.options.getString('name')

        // Check if tokens array exists
        if (!gameData.tokens || !gameData.tokens.length) {
            return await interaction.reply({ content: "No tokens exist in this game!", ephemeral: true })
        }

        // Find token index
        const tokenIndex = gameData.tokens.findIndex(token => token.name === name)
        if (tokenIndex === -1) {
            return await interaction.reply({ content: `Token "${name}" not found!`, ephemeral: true })
        }

        // Remove token
        const removedToken = gameData.tokens.splice(tokenIndex, 1)[0]

        // Remove token from all players
        if (gameData.players) {
            gameData.players.forEach(player => {
                if (player.tokens && player.tokens[name]) {
                    delete player.tokens[name]
                }
            })
        }

        // Save game data
        await GameDB.set(interaction.channel.id, gameData)

        const embed = new EmbedBuilder()
            .setTitle('Token Removed')
            .setDescription(`Removed token type: ${name}`)
            .addFields(
                { name: 'Was Secret', value: removedToken.secret ? 'Yes' : 'No', inline: true }
            )
            .setColor('#FF0000')

        await interaction.reply({ embeds: [embed] })
    }
}

module.exports = Remove 