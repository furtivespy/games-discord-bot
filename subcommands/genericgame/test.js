const GameDB = require('../../db/anygame.js'); // Included for context, but defaultGameData might not be used.
const { cloneDeep } = require('lodash'); // Included for context, cloneDeep might not be used if data is static.
const Formatter = require('../../modules/GameFormatter');

class Test {
    async execute(interaction, client) { // interaction and client might be undefined or partially mocked in a direct test execution.

        await interaction.deferReply()
        const gameData = Object.assign(
            {},
            GameDB.defaultGameData,
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        )

        if (gameData.isdeleted) {
            return await interaction.editReply({ content: "No game in progress!", ephemeral: true })
        }

        // Get secret tokens for the command caller
        const player = find(gameData.players, { userId: interaction.user.id })
        const secretTokensEmbed = player ? await Formatter.playerSecretTokens(gameData, player) : null

        await interaction.editReply(
            await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id)
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

module.exports = new Test();