const GlobalGameHelper = require('../../modules/GlobalGameHelper'); // Corrected path
const GameDB = require('../../db/anygame.js');
const { SlashCommandSubcommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('playarea')
        .setDescription('Toggles or sets the Play Area mode (cards go to Play Area or Discard Pile).')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Set to "on" to use play areas, "off" to play to discard.')
                .setRequired(false)
                .addChoices(
                    { name: 'On', value: 'on' },
                    { name: 'Off', value: 'off' }
                )),
    async execute(interaction) {
        try {
            await interaction.deferReply();
            const gameData = await GlobalGameHelper.getGameData(interaction.client, interaction);

            if (gameData.isdeleted) {
                return interaction.editReply({ content: "No active game found in this channel. Start a new game first."});
            }

            const desiredMode = interaction.options.getString('mode');
            let finalMode;

            if (desiredMode === 'on') {
                gameData.playToPlayArea = true;
                finalMode = true;
            } else if (desiredMode === 'off') {
                gameData.playToPlayArea = false;
                finalMode = false;
            } else { // Toggle if no specific mode is set
                gameData.playToPlayArea = !gameData.playToPlayArea;
                finalMode = gameData.playToPlayArea;
            }

            // Record history for play area mode change
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                const modeText = finalMode ? 'ON (cards go to Player Areas)' : 'OFF (cards go to Discard Pile)'
                
                GlobalGameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.GAME,
                    GameDB.ACTION_TYPES.MODIFY,
                    `${actorDisplayName} set Play Area mode to ${modeText}`,
                    {
                        newMode: finalMode,
                        modeDescription: modeText,
                        wasToggled: !desiredMode,
                        specifiedMode: desiredMode || 'toggle',
                        actorUserId: interaction.user.id,
                        actorUsername: actorDisplayName
                    }
                )
            } catch (error) {
                console.warn('Failed to record play area mode change in history:', error)
            }

            // Save the updated game data
            await interaction.client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData);

            const status = finalMode ? "ON (cards will go to Player Areas)" : "OFF (cards will go to Discard Pile)";
            await interaction.editReply(`Play Area mode is now ${status}.`);

        } catch (e) {
            interaction.client.logger.log(e, 'error');
            await interaction.editReply({ content: "An error occurred while trying to toggle the play area setting."});
        }
    }
};
