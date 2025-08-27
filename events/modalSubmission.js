const { Events } = require('discord.js');
const GameHelper = require('../modules/GlobalGameHelper');
const GameDB = require('../db/anygame.js');
const Formatter = require('../modules/GameFormatter');
const { find } = require('lodash');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isModalSubmit()) return;

        if (interaction.customId === 'colorall-modal') {
            await interaction.deferReply();
            let gameData = await GameHelper.getGameData(interaction.client, interaction);

            if (gameData.isdeleted) {
                await interaction.editReply({
                    content: `No active game in this channel.`,
                    ephemeral: true
                });
                return;
            }

            let changes = [];

            for (const player of gameData.players) {
                const newColor = interaction.fields.getTextInputValue(`color-${player.userId}`);
                if (newColor && player.color !== newColor) {
                    const oldColor = player.color;
                    player.color = newColor;
                    const member = await interaction.guild.members.fetch(player.userId);
                    const playerName = member ? member.displayName : `Player ${player.userId}`;
                    changes.push({ playerName, oldColor, newColor });
                }
            }

            if (changes.length > 0) {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username;
                let historyMessage = `${actorDisplayName} updated player colors:\n`;
                historyMessage += changes.map(c => `${c.playerName}'s color changed from ${c.oldColor || 'default'} to ${c.newColor}`).join('\n');

                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.PLAYER,
                    GameDB.ACTION_TYPES.MODIFY,
                    historyMessage,
                    { changes }
                );

                await interaction.client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
            }

            await interaction.editReply(
                await Formatter.createGameStatusReply(gameData, interaction.guild, interaction.client.user.id, {
                    content: `Player colors updated successfully.`
                })
            );
        }
    },
};
