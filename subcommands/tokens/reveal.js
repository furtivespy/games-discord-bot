const { EmbedBuilder } = require('discord.js')
const { find } = require('lodash')
const GameDB = require('../../db/anygame')

class Reveal {
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

        const player = find(gameData.players, { userId: interaction.user.id })
        if (!player) {
            return await interaction.reply({ content: "You're not in this game!", ephemeral: true })
        }

        if (name) {
            // Check specific token
            const token = find(gameData.tokens, { name })
            if (!token) {
                return await interaction.reply({ content: `Token "${name}" not found!`, ephemeral: true })
            }

            // Show all players' counts for the specified token
            const embed = new EmbedBuilder()
                .setTitle(`${name} Token Counts (Revealed)`)
                .setDescription(token.description || 'No description')
                .setColor('#FF0000')

            gameData.players.forEach(p => {
                const count = p.tokens?.[token.id] || 0
                const displayName = interaction.guild.members.cache.get(p.userId)?.displayName ?? p.name ?? p.userId
                embed.addFields({ name: displayName, value: count.toString(), inline: true })
            })

            return await interaction.reply({ embeds: [embed] })
        } else {
            // Show all tokens
            const embed = new EmbedBuilder()
                .setTitle('All Token Counts (Revealed)')
                .setColor('#FF0000')

            gameData.tokens.forEach(token => {
                const field = { 
                    name: `${token.name}${token.isSecret ? ' (Secret)' : ''}`,
                    value: gameData.players.map(p => {
                        const displayName = interaction.guild.members.cache.get(p.userId)?.displayName ?? p.name ?? p.userId
                        return `${displayName}: ${p.tokens?.[token.id] || 0}`
                    }).join('\n'),
                    inline: false
                }
                embed.addFields(field)
            })

            return await interaction.reply({ embeds: [embed] })
        }
    }
}

module.exports = Reveal 