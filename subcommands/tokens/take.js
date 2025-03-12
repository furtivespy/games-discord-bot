const { EmbedBuilder } = require('discord.js')
const { find } = require('lodash')
const GameDB = require('../../db/anygame')

class Take {
    static async execute(interaction, client) {
        const gameData = await GameDB.get(interaction.channel.id)
        if (!gameData) {
            return await interaction.reply({ content: "No game in progress!", ephemeral: true })
        }

        const name = interaction.options.getString('name')
        const amount = interaction.options.getInteger('amount')
        const targetUser = interaction.options.getUser('player')

        if (amount <= 0) {
            return await interaction.reply({ content: "Amount must be positive!", ephemeral: true })
        }

        // Check if token exists
        const token = find(gameData.tokens, { name })
        if (!token) {
            return await interaction.reply({ content: `Token "${name}" not found!`, ephemeral: true })
        }

        // Find source player (who is taking)
        const sourcePlayer = find(gameData.players, { userId: interaction.user.id })
        if (!sourcePlayer) {
            return await interaction.reply({ content: "You're not in this game!", ephemeral: true })
        }

        // Find target player (who is being taken from)
        const targetPlayer = find(gameData.players, { userId: targetUser.id })
        if (!targetPlayer) {
            return await interaction.reply({ content: "Target player is not in this game!", ephemeral: true })
        }

        // Check if target player has enough tokens
        const targetAmount = targetPlayer.tokens?.[name] || 0
        if (targetAmount < amount) {
            return await interaction.reply({ 
                content: `${targetPlayer.name} doesn't have enough ${name} tokens! They only have ${targetAmount}.`,
                ephemeral: true 
            })
        }

        // Initialize tokens objects if needed
        if (!sourcePlayer.tokens) sourcePlayer.tokens = {}
        if (!targetPlayer.tokens) targetPlayer.tokens = {}

        // Transfer tokens
        targetPlayer.tokens[name] = targetAmount - amount
        sourcePlayer.tokens[name] = (sourcePlayer.tokens[name] || 0) + amount

        // Save game data
        await GameDB.set(interaction.channel.id, gameData)

        // Create embed for source player
        const sourceEmbed = new EmbedBuilder()
            .setTitle('Tokens Taken')
            .setDescription(`You took ${amount} ${name} token(s) from ${targetPlayer.name}`)
            .addFields(
                { name: 'Your New Total', value: sourcePlayer.tokens[name].toString(), inline: true }
            )
            .setColor('#FF0000')

        // Create embed for target player
        const targetEmbed = new EmbedBuilder()
            .setTitle('Tokens Lost')
            .setDescription(`${sourcePlayer.name} took ${amount} ${name} token(s) from you`)
            .addFields(
                { name: 'Your New Total', value: targetPlayer.tokens[name].toString(), inline: true }
            )
            .setColor('#FF0000')

        // If token is secret, send private messages to both players
        if (token.secret) {
            await interaction.reply({ 
                embeds: [sourceEmbed],
                ephemeral: true
            })
            try {
                await targetUser.send({ embeds: [targetEmbed] })
            } catch (error) {
                await interaction.followUp({ 
                    content: "Could not send private message to target player.",
                    ephemeral: true
                })
            }
        } else {
            // For public tokens, show the transfer publicly
            const publicEmbed = new EmbedBuilder()
                .setTitle('Token Transfer')
                .setDescription(`${sourcePlayer.name} took ${amount} ${name} token(s) from ${targetPlayer.name}`)
                .setColor('#FF0000')

            await interaction.reply({ embeds: [publicEmbed] })
            
            // Send private updates to both players
            await interaction.followUp({ embeds: [sourceEmbed], ephemeral: true })
            try {
                await targetUser.send({ embeds: [targetEmbed] })
            } catch (error) {
                await interaction.followUp({ 
                    content: "Could not send private message to target player.",
                    ephemeral: true
                })
            }
        }
    }
}

module.exports = Take 