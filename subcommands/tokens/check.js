const { EmbedBuilder } = require('discord.js')
const { find } = require('lodash')
const GameDB = require('../../db/anygame')
const GameFormatter = require('../../modules/GameFormatter')

class Check {
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
        const showAll = interaction.options.getBoolean('all') || false

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

            if (token.isSecret && !showAll) {
                // For secret tokens, only show the player's own count
                const count = player.tokens?.[token.id] || 0
                const embed = new EmbedBuilder()
                    .setTitle(`Your ${name} Tokens`)
                    .setDescription(`You have ${count} ${name} token(s)`)
                    .setColor('#0099FF')
                
                return await interaction.reply({ embeds: [embed], ephemeral: true })
            } else {
                // For public tokens or when showAll is true, show all players' counts
                const embed = new EmbedBuilder()
                    .setTitle(`${name} Token Counts`)
                    .setDescription(token.description || 'No description')
                    .setColor('#0099FF')

                gameData.players.forEach(p => {
                    const count = p.tokens?.[token.id] || 0
                    const displayName = interaction.guild.members.cache.get(p.userId)?.displayName ?? p.name ?? p.userId
                    embed.addFields({ name: displayName, value: count.toString(), inline: true })
                })

                return await interaction.reply({ 
                    embeds: [embed], 
                    ephemeral: !showAll 
                })
            }
        } else {
            // Show all tokens
            const publicEmbed = new EmbedBuilder()
                .setTitle('Token Counts')
                .setColor('#0099FF')

            const secretEmbed = new EmbedBuilder()
                .setTitle('Your Secret Token Counts')
                .setColor('#FF0000')

            let hasPublicTokens = false
            let hasSecretTokens = false

            gameData.tokens.forEach(token => {
                if (token.isSecret && !showAll) {
                    hasSecretTokens = true
                    const count = player.tokens?.[token.id] || 0
                    secretEmbed.addFields({ 
                        name: token.name, 
                        value: `${count}${token.description ? ` - ${token.description}` : ''}`,
                        inline: true 
                    })
                } else {
                    hasPublicTokens = true
                    const field = { 
                        name: token.name,
                        value: gameData.players.map(p => {
                            const displayName = interaction.guild.members.cache.get(p.userId)?.displayName ?? p.name ?? p.userId
                            return `${displayName}: ${p.tokens?.[token.id] || 0}`
                        }).join('\n'),
                        inline: false
                    }
                    publicEmbed.addFields(field)
                }
            })

            const embeds = []
            if (hasPublicTokens) embeds.push(publicEmbed)
            if (hasSecretTokens) embeds.push(secretEmbed)

            return await interaction.reply({ 
                embeds, 
                ephemeral: !showAll || hasSecretTokens
            })
        }
    }
}

module.exports = Check 