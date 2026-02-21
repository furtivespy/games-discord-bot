const GameHelper = require('../../modules/GlobalGameHelper')
const {ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags} = require('discord.js');

class ScoreAll {
    async execute(interaction, client) {
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.reply({
                content: `No active game in this channel.`,
                flags: MessageFlags.Ephemeral
            })
            return
        }

        if (!gameData.players || gameData.players.length === 0) {
            await interaction.reply({
                content: `No players in the game.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (gameData.players.length > 5) {
            await interaction.reply({
                content: `There are too many players in the game to use this command. The maximum is 5.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId('scoreall-modal')
            .setTitle('Set All Player Scores');

        const promises = gameData.players.map(async (player) => {
            let member = interaction.guild.members.cache.get(player.userId);
            if (!member) {
                member = await interaction.guild.members.fetch(player.userId);
            }
            const playerName = member ? member.displayName : `Player ${player.userId}`;

            const scoreInput = new TextInputBuilder()
                .setCustomId(`score-${player.userId}`)
                .setLabel(playerName)
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            if (player.score) {
                scoreInput.setValue(player.score.toString());
            }
            return new ActionRowBuilder().addComponents(scoreInput)
        });
        const components = await Promise.all(promises)
        modal.addComponents(components);

        await interaction.showModal(modal);
    }
}

module.exports = new ScoreAll()