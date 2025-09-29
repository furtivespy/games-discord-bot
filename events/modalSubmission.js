const GameHelper = require('../modules/GlobalGameHelper');
const GameDB = require('../db/anygame.js');
const GameStatusHelper = require('../modules/GameStatusHelper');

module.exports = {
    async execute(interaction) {
        if (!interaction.isModalSubmit()) return;

        const client = interaction.client;

        if (interaction.customId === 'colorall-modal') {
            await interaction.deferReply();
            let gameData = await GameHelper.getGameData(client, interaction);

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

                await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
            }

            await GameStatusHelper.sendGameStatus(interaction, interaction.client, gameData, {
                content: `Player colors updated successfully.`
            });
        } else if (interaction.customId === 'scoreall-modal') {
            await interaction.deferReply();
            let gameData = await GameHelper.getGameData(client, interaction);

            if (gameData.isdeleted) {
                await interaction.editReply({
                    content: `No active game in this channel.`,
                    ephemeral: true
                });
                return;
            }

            let changes = [];

            for (const player of gameData.players) {
                const newScore = interaction.fields.getTextInputValue(`score-${player.userId}`);
                if (newScore && player.score !== newScore) {
                    const oldScore = player.score;
                    player.score = newScore;
                    const member = await interaction.guild.members.fetch(player.userId);
                    const playerName = member ? member.displayName : `Player ${player.userId}`;
                    changes.push({ playerName, oldScore, newScore });
                }
            }

            if (changes.length > 0) {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username;
                let historyMessage = `${actorDisplayName} updated player scores:\n`;
                historyMessage += changes.map(c => `${c.playerName}'s score changed from ${c.oldScore || '0'} to ${c.newScore}`).join('\n');

                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.PLAYER,
                    GameDB.ACTION_TYPES.SCORE,
                    historyMessage,
                    { changes }
                );

                await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
            }

            await GameStatusHelper.sendGameStatus(interaction, interaction.client, gameData, {
                content: `Player scores updated successfully.`
            });
        }
    }
};