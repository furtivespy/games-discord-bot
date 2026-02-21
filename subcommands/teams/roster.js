const GameHelper = require('../../modules/GlobalGameHelper')
const {ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags} = require('discord.js');

class Roster {
    async execute(interaction, client) {
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.reply({
                content: `No active game in this channel.`,
                flags: MessageFlags.Ephemeral
            })
            return
        }

        const modal = new ModalBuilder()
            .setCustomId('team-roster-modal')
            .setTitle('Set Team Names');

        // Create 5 text inputs for team names
        for (let i = 0; i < 5; i++) {
            const existingTeam = gameData.teams && gameData.teams[i] ? gameData.teams[i] : null
            
            const teamInput = new TextInputBuilder()
                .setCustomId(`team-${i}`)
                .setLabel(`Team ${i + 1} Name`)
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(50)

            if (existingTeam && existingTeam.name) {
                teamInput.setValue(existingTeam.name)
            }

            const actionRow = new ActionRowBuilder().addComponents(teamInput)
            modal.addComponents(actionRow)
        }

        await interaction.showModal(modal)
    }
}

module.exports = new Roster()

