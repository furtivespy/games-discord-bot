const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js');
const { find } = require('lodash');
const Formatter = require('../../modules/GameFormatter');
const GameStatusHelper = require('../../modules/GameStatusHelper');

class Test {
    async execute(interaction, client) {
        const [, gameData] = await Promise.all([
            interaction.deferReply(),
            client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        ]);

        if (!gameData || gameData.isdeleted) {
            return await interaction.editReply({ content: "No game in progress!"});
        }

        // Main status send and the secondary token render are independent of each other
        const player = find(gameData.players, { userId: interaction.user.id });
        const [, secretTokensEmbed] = await Promise.all([
            GameStatusHelper.sendGameStatus(interaction, client, gameData, { explicitStatus: true }),
            player ? Formatter.playerSecretTokens(gameData, player) : Promise.resolve(null)
        ]);

        if (secretTokensEmbed) {
            await interaction.followUp({
                embeds: [secretTokensEmbed],
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Error sending secret token followup in test command:", e));
        }
    }
}

module.exports = new Test();