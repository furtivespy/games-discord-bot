const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class Color {
    async execute(interaction, client) {
        await interaction.deferReply()

        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({
                content: `No active game in this channel.`,
                ephemeral: true
            })
            return
        }

        const targetPlayer = interaction.options.getUser('player')
        const colorInput = interaction.options.getString('color')

        // Find the player in the game
        const player = find(gameData.players, { userId: targetPlayer.id })
        if (!player) {
            await interaction.editReply({
                content: `${targetPlayer} is not in this game!`,
                ephemeral: true
            })
            return
        }

        // Validate color input (basic validation, can be expanded)
        // For now, we'll accept any string. Discord might not support all named colors directly in markdown.
        // Hex codes should be in the format #RRGGBB or #RGB
        if (!(/^#[0-9A-F]{6}$/i.test(colorInput) || /^[a-zA-Z]+$/i.test(colorInput) || /^#[0-9A-F]{3}$/i.test(colorInput))) {
            // Basic check for common color names or hex codes. This is not exhaustive.
            // A more robust solution might involve a library or a predefined list of supported color names.
            // For now, we allow most strings but could warn if it's not a hex.
            // client.logger.log(`Potentially invalid color format: ${colorInput}`);
        }

        const oldColor = player.color
        player.color = colorInput

        // Record history for color change
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const targetPlayerName = interaction.guild.members.cache.get(targetPlayer.id)?.displayName || targetPlayer.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.PLAYER,
                GameDB.ACTION_TYPES.MODIFY,
                `${actorDisplayName} set ${targetPlayerName}'s color to ${colorInput}`,
                {
                    targetUserId: targetPlayer.id,
                    targetUsername: targetPlayerName,
                    oldColor: oldColor || 'default',
                    newColor: colorInput,
                    actorUserId: interaction.user.id,
                    actorUsername: actorDisplayName
                }
            )
        } catch (error) {
            console.warn('Failed to record color change in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
            content: `Set color for ${targetPlayer.username} to **${colorInput}**.`
        })
    }
}

module.exports = new Color()