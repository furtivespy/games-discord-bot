const GameHelper = require('../../modules/GlobalGameHelper')
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

class ColorAll {
    async execute(interaction, client) {
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.reply({
                content: `No active game in this channel.`,
                ephemeral: true
            })
            return
        }

        if (!gameData.players || gameData.players.length === 0) {
            await interaction.reply({
                content: `No players in the game.`,
                ephemeral: true
            });
            return;
        }

        if (gameData.players.length > 5) {
            await interaction.reply({
                content: `There are too many players in the game to use this command. The maximum is 5.`,
                ephemeral: true
            });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId('colorall-modal')
            .setTitle('Set All Player Colors');

        const promises = gameData.players.map(async (player) => {
            let member = interaction.guild.members.cache.get(player.userId);
            if (!member) {
                member = await interaction.guild.members.fetch(player.userId);
            }
            const playerName = member ? member.displayName : `Player ${player.userId}`;

            const colorInput = new TextInputBuilder()
                .setCustomId(`color-${player.userId}`)
                .setLabel(playerName)
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            if (player.color) {
                colorInput.setValue(player.color);
            }
            return new ActionRowBuilder().addComponents(colorInput)
        });
        const components = await Promise.all(promises)
        modal.addComponents(components);

        await interaction.showModal(modal);
    }
}

module.exports = new ColorAll()
