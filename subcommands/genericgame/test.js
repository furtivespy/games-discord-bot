const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js');
const { find } = require('lodash');
const Formatter = require('../../modules/GameFormatter');
const GameStatusHelper = require('../../modules/GameStatusHelper');

class Test {
    async execute(interaction, client) {
        await interaction.deferReply();
        const gameData = await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId);

        if (!gameData || gameData.isdeleted) {
            return await interaction.editReply({ content: "No game in progress!"});
        }

        const player = find(gameData.players, { userId: interaction.user.id });
        const secretTokensEmbed = player ? await Formatter.playerSecretTokens(gameData, player) : null;

        await GameStatusHelper.sendGameStatus(interaction, client, gameData);

        if (secretTokensEmbed) {
            await interaction.followUp({
                embeds: [secretTokensEmbed],
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Error sending secret token followup in test command:", e));
        }
    }
}

module.exports = new Test();