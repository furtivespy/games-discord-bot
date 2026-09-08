const GlobalGameHelper = require('../../modules/GlobalGameHelper');
const GameStatusHelper = require('../../modules/GameStatusHelper');
const GameDB = require('../../db/anygame.js');
const { SlashCommandSubcommandBuilder } = require('discord.js');

const MODE_STATUS_TEXT = {
    off: 'OFF. Chat status posts are unchanged.',
    on: 'ON. A pinned live status message will be kept up to date in this channel.',
    full: 'FULL. A pinned live status message will be kept up to date. State-changing commands will not post the full status table in chat; use /game status when you want the table in chat.',
};

const MODE_HISTORY_TEXT = {
    off: 'OFF',
    on: 'ON (pinned live status)',
    full: 'FULL (pinned live status, no chat table)',
};

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('pinnedstatus')
        .setDescription('Sets the pinned live status message for this game (default: off).')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('off: no pin. on: pin + chat table. full: pin only (chat keeps command replies).')
                .setRequired(false)
                .addChoices(
                    { name: 'On', value: 'on' },
                    { name: 'Off', value: 'off' },
                    { name: 'Full', value: 'full' }
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
            const currentMode = GameStatusHelper.resolvePinnedStatusMode(gameData);
            let finalMode;

            if (GameStatusHelper.isValidPinnedStatusMode(desiredMode)) {
                finalMode = desiredMode;
            } else {
                // Toggle stays on ↔ off (full counts as on for toggle purposes).
                finalMode = currentMode === 'off' ? 'on' : 'off';
            }

            GameStatusHelper.setPinnedStatusMode(gameData, finalMode);

            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username;
                const modeText = MODE_HISTORY_TEXT[finalMode];

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

            if (finalMode === 'off') {
                try {
                    await GameStatusHelper.clearPinnedStatus(interaction.channel, interaction.client, gameData, { ended: false });
                } catch (error) {
                    console.error('Failed to clear pinned live status after disabling it.', error);
                }
            }

            await interaction.client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData);

            if (finalMode !== 'off') {
                try {
                    await GameStatusHelper.upsertPinnedStatus(interaction.channel, interaction.client, interaction, gameData);
                } catch (error) {
                    console.error('Failed to create pinned live status after enabling it.', error);
                }
            }

            const pinEnabled = finalMode !== 'off';
            const status = MODE_STATUS_TEXT[finalMode];
            const manualPinNotice = pinEnabled
                ? GameStatusHelper.buildManualPinCommandNotice(interaction.channel, interaction.client, gameData)
                : '';
            await interaction.editReply(`Pinned live status is now ${status}${manualPinNotice}`);

        } catch (e) {
            interaction.client.logger.log(e, 'error');
            await interaction.editReply({ content: "An error occurred while trying to toggle the pinned live status setting."});
        }
    }
};
