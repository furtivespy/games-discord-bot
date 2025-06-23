const GlobalGameHelper = require('../../../modules/GlobalGameHelper'); // Adjusted path
const { SlashCommandSubcommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('playarea')
        .setDescription('Toggles the Play Area mode for the current game.')
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
                return interaction.editReply({ content: "No active game found in this channel. Start a new game first.", ephemeral: true });
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

            // Save the updated game data
            await interaction.client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData);

            const status = finalMode ? "ON (cards will go to Player Areas)" : "OFF (cards will go to Discard Pile)";
            await interaction.editReply(`Play Area mode is now ${status}.`);

        } catch (e) {
            interaction.client.logger.log(e, 'error');
            await interaction.editReply({ content: "An error occurred while trying to toggle the play area setting.", ephemeral: true });
        }
    }
};
