const GlobalGameHelper = require('../../modules/GlobalGameHelper');
const GameStatusHelper = require('../../modules/GameStatusHelper');
const GameDB = require('../../db/anygame.js');
const { SlashCommandSubcommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('pinnedstatus')
        .setDescription('Toggles or sets the pinned live status message for this game (default: off).')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Set to "on" to keep a pinned live status, "off" to disable it.')
                .setRequired(false)
                .addChoices(
                    { name: 'On', value: 'on' },
                    { name: 'Off', value: 'off' }
                )),
    async execute(interaction) {
        try {
            const [, gameData] = await Promise.all([
                interaction.deferReply(),
                GlobalGameHelper.getGameData(interaction.client, interaction)
            ]);

            if (gameData.isdeleted) {
                return interaction.editReply({ content: "No active game found in this channel. Start a new game first."});
            }

            const desiredMode = interaction.options.getString('mode');
            let finalMode;

            if (desiredMode === 'on') {
                gameData.pinnedStatusEnabled = true;
                finalMode = true;
            } else if (desiredMode === 'off') {
                gameData.pinnedStatusEnabled = false;
                finalMode = false;
            } else {
                gameData.pinnedStatusEnabled = !gameData.pinnedStatusEnabled;
                finalMode = gameData.pinnedStatusEnabled;
            }

            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username;
                const modeText = finalMode ? 'ON (pinned live status)' : 'OFF';

                GlobalGameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.GAME,
                    GameDB.ACTION_TYPES.MODIFY,
                    `${actorDisplayName} set pinned live status to ${modeText}`,
                    {
                        newMode: finalMode,
                        modeDescription: modeText,
                        wasToggled: !desiredMode,
                        specifiedMode: desiredMode || 'toggle',
                        actorUserId: interaction.user.id,
                        actorUsername: actorDisplayName
                    }
                );
            } catch (error) {
                console.warn('Failed to record pinned status mode change in history:', error);
            }

            if (!finalMode) {
                try {
                    await GameStatusHelper.clearPinnedStatus(interaction.channel, interaction.client, gameData, { ended: false });
                } catch (error) {
                    console.error('Failed to clear pinned live status after disabling it.', error);
                }
            }

            await interaction.client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData);

            if (finalMode) {
                try {
                    await GameStatusHelper.upsertPinnedStatus(interaction.channel, interaction.client, interaction, gameData);
                } catch (error) {
                    console.error('Failed to create pinned live status after enabling it.', error);
                }
            }

            const status = finalMode
                ? "ON. A pinned live status message will be kept up to date in this channel."
                : "OFF. Chat status posts are unchanged.";
            await interaction.editReply(`Pinned live status is now ${status}`);

        } catch (e) {
            interaction.client.logger.log(e, 'error');
            await interaction.editReply({ content: "An error occurred while trying to toggle the pinned live status setting."});
        }
    }
};
