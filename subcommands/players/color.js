const GameHelper = require('../../modules/GlobalGameHelper')
const { find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

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

        player.color = colorInput;

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await interaction.editReply(
            await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id, {
                content: `Set color for ${targetPlayer.username} to **${colorInput}**.`
            })
        )
    }
}

module.exports = new Color()
