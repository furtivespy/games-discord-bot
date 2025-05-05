const { find } = require('lodash')
const { AttachmentBuilder } = require('discord.js')
const GameDB = require('../../db/anygame')
const Formatter = require('../../modules/GameFormatter')

class Status {
    static async execute(interaction, client) {
        await interaction.deferReply()
        const gameData = Object.assign(
            {},
            GameDB.defaultGameData,
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        )

        if (gameData.isdeleted) {
            return await interaction.editReplyeply({ content: "No game in progress!", ephemeral: true })
        }

        // Get secret tokens for the command caller
        const player = find(gameData.players, { userId: interaction.user.id })
        const secretTokensEmbed = player ? await Formatter.playerSecretTokens(gameData, player) : null

        await interaction.editReply(
            await Formatter.createGameStatusReply(gameData, interaction.guild)
        );

        // If the player has secret tokens, send them in an ephemeral followup
        if (secretTokensEmbed) {
            await interaction.followUp({
                embeds: [secretTokensEmbed],
                ephemeral: true
            })
        }
    }
}

module.exports = Status