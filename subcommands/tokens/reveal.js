const {EmbedBuilder, MessageFlags} = require('discord.js')
const { find } = require('lodash')
const GameDB = require('../../db/anygame')
const GameHelper = require('../../modules/GlobalGameHelper')

class Reveal {
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

        // Check if tokens exist
        if (!gameData.tokens || !gameData.tokens.length) {
            return await interaction.reply({ content: "No tokens exist in this game!", flags: MessageFlags.Ephemeral })
        }

        const player = find(gameData.players, { userId: interaction.user.id })
        if (!player) {
            return await interaction.reply({ content: "You're not in this game!", flags: MessageFlags.Ephemeral })
        }

        if (name) {
            // Check specific token
            const token = find(gameData.tokens, { name })
            if (!token) {
                return await interaction.reply({ content: `Token "${name}" not found!`, flags: MessageFlags.Ephemeral })
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

            // Record history for specific token revelation
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                const tokenCounts = gameData.players.map(p => ({
                    userId: p.userId,
                    displayName: interaction.guild.members.cache.get(p.userId)?.displayName || p.name || p.userId,
                    count: p.tokens?.[token.id] || 0
                }))
                
                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.TOKEN,
                    GameDB.ACTION_TYPES.REVEAL,
                    `${actorDisplayName} revealed ${token.name} token counts to all players`,
                    {
                        tokenName: token.name,
                        tokenId: token.id,
                        tokenDescription: token.description,
                        isSecretToken: token.isSecret,
                        revealedCounts: tokenCounts,
                        totalPlayersAffected: gameData.players.length
                    }
                )
                
                await client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData)
            } catch (error) {
                console.warn('Failed to record token reveal in history:', error)
            }

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

            // Record history for all tokens revelation
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                const allTokenInfo = gameData.tokens.map(token => ({
                    tokenName: token.name,
                    tokenId: token.id,
                    isSecret: token.isSecret,
                    playerCounts: gameData.players.map(p => ({
                        userId: p.userId,
                        displayName: interaction.guild.members.cache.get(p.userId)?.displayName || p.name || p.userId,
                        count: p.tokens?.[token.id] || 0
                    }))
                }))
                
                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.TOKEN,
                    GameDB.ACTION_TYPES.REVEAL,
                    `${actorDisplayName} revealed ALL token counts (${gameData.tokens.length} types) to all players`,
                    {
                        tokenTypesRevealed: gameData.tokens.length,
                        secretTokensIncluded: gameData.tokens.filter(t => t.isSecret).length,
                        allTokenInfo: allTokenInfo,
                        totalPlayersAffected: gameData.players.length
                    }
                )
                
                await client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData)
            } catch (error) {
                console.warn('Failed to record all tokens reveal in history:', error)
            }

            return await interaction.reply({ embeds: [embed] })
        }
    }
}

module.exports = Reveal 