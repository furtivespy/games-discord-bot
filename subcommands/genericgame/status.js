const { find } = require('lodash')
const GameDB = require('../../db/anygame')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class Status {
    static async execute(interaction, client) {
        await interaction.deferReply()
        const gameData = await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)

        if (!gameData || gameData.isdeleted) {
            return await interaction.editReply({ content: "No game in progress!", ephemeral: true })
        }

        // Get secret tokens for the command caller
        const player = find(gameData.players, { userId: interaction.user.id })
        const secretTokensEmbed = player ? await Formatter.playerSecretTokens(gameData, player) : null

        await GameStatusHelper.sendGameStatus(interaction, client, gameData, { content: "📊" });

        // If the player has secret tokens, send them in an ephemeral followup
        if (secretTokensEmbed) {
            await interaction.followUp({
                embeds: [secretTokensEmbed],
                ephemeral: true
            }).catch(e => console.error("Error sending secret token followup:", e));
        }
    }
}

module.exports = Status