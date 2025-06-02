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
                const userCount = player.tokens?.[token.id] || 0;
                const embed = new EmbedBuilder()
                    .setTitle(`Your ${name} Tokens (Secret)`)
                    .setColor('#0099FF'); // Keep a distinct color or add to title to emphasize it's a secret token check

                let descriptionLines = [`You personally have: ${userCount} ${name} token(s).`];

                const tokenCap = token.cap;
                if (typeof tokenCap === 'number') {
                    let totalTokensHeldByAllPlayers = 0;
                    gameData.players.forEach(p => {
                        if (p.tokens && p.tokens[token.id]) {
                            totalTokensHeldByAllPlayers += p.tokens[token.id];
                        }
                    });
                    const availableTokens = tokenCap - totalTokensHeldByAllPlayers;

                    descriptionLines.push(`\n--- Overall Token Details ---`);
                    descriptionLines.push(`Cap: ${tokenCap}`);
                    descriptionLines.push(`In Circulation (All Players): ${totalTokensHeldByAllPlayers}`);
                    descriptionLines.push(`Available to be Gained (Overall): ${availableTokens > 0 ? availableTokens : 0}`);
                } else {
                    descriptionLines.push(`This token type does not have a defined cap.`);
                }

                embed.setDescription(descriptionLines.join('\n'));
                
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                // For public tokens or when showAll is true, show all players' counts
                const embed = new EmbedBuilder()
                    .setTitle(`${name} Token Counts`)
                    .setDescription(token.description || 'No description')
                    .setColor('#0099FF')

                const tokenCap = token.cap;
                let totalTokensHeldByAllPlayers = 0;
                if (typeof tokenCap === 'number') {
                    gameData.players.forEach(p => {
                        if (p.tokens && p.tokens[token.id]) {
                            totalTokensHeldByAllPlayers += p.tokens[token.id];
                        }
                    });
                }
                const availableTokens = typeof tokenCap === 'number' ? tokenCap - totalTokensHeldByAllPlayers : Infinity;

                gameData.players.forEach(p => {
                    const count = p.tokens?.[token.id] || 0
                    const displayName = interaction.guild.members.cache.get(p.userId)?.displayName ?? p.name ?? p.userId
                    embed.addFields({ name: displayName, value: count.toString(), inline: true })
                })

                if (typeof tokenCap === 'number' && (!token.isSecret || showAll)) {
                    embed.addFields(
                        { name: 'Cap', value: tokenCap.toString(), inline: true },
                        { name: 'In Circulation', value: totalTokensHeldByAllPlayers.toString(), inline: true },
                        { name: 'Available', value: (availableTokens > 0 ? availableTokens : 0).toString(), inline: true }
                    );
                }

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
                    let valueString = gameData.players.map(p => {
                        const displayName = interaction.guild.members.cache.get(p.userId)?.displayName ?? p.name ?? p.userId
                        return `${displayName}: ${p.tokens?.[token.id] || 0}`
                    }).join('\n');

                    const tokenCap = token.cap;
                    if (typeof tokenCap === 'number') {
                        let totalTokensHeldByAllPlayers = 0;
                        gameData.players.forEach(p => {
                            if (p.tokens && p.tokens[token.id]) {
                                totalTokensHeldByAllPlayers += p.tokens[token.id];
                            }
                        });
                        const availableTokens = tokenCap - totalTokensHeldByAllPlayers;
                        valueString += `\nCap: ${tokenCap} | In Circulation: ${totalTokensHeldByAllPlayers} | Available: ${availableTokens > 0 ? availableTokens : 0}`;
                    }

                    const field = { 
                        name: `${token.name}${token.description ? ` - ${token.description}` : ''}`,
                        value: valueString,
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