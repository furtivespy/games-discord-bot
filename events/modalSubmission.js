const GameHelper = require('../modules/GlobalGameHelper');
const GameDB = require('../db/anygame.js');
const GameStatusHelper = require('../modules/GameStatusHelper');
const { cloneDeep } = require('lodash');
const { nanoid } = require('nanoid');

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
        } else if (interaction.customId === 'team-roster-modal') {
            await interaction.deferReply();
            let gameData = await GameHelper.getGameData(client, interaction);

            if (gameData.isdeleted) {
                await interaction.editReply({
                    content: `No active game in this channel.`,
                    ephemeral: true
                });
                return;
            }

            // Initialize teams array if it doesn't exist
            if (!gameData.teams) {
                gameData.teams = [];
            }

            const submittedTeamNames = [];
            const changes = [];

            // Parse the 5 team name inputs
            for (let i = 0; i < 5; i++) {
                const teamName = interaction.fields.getTextInputValue(`team-${i}`).trim();
                if (teamName) {
                    submittedTeamNames.push({ index: i, name: teamName });
                }
            }

            // Update or create teams based on submitted names
            for (const { index, name } of submittedTeamNames) {
                if (gameData.teams[index]) {
                    // Update existing team name if changed
                    if (gameData.teams[index].name !== name) {
                        const oldName = gameData.teams[index].name;
                        gameData.teams[index].name = name;
                        changes.push({ action: 'renamed', oldName, newName: name });
                    }
                } else {
                    // Create new team
                    const newTeam = Object.assign(
                        {},
                        cloneDeep(GameDB.defaultTeam),
                        {
                            id: nanoid(),
                            name: name
                        }
                    );
                    // Fill in gaps if needed
                    while (gameData.teams.length < index) {
                        gameData.teams.push(null);
                    }
                    gameData.teams[index] = newTeam;
                    changes.push({ action: 'created', name });
                }
            }

            // Remove null entries from teams array
            gameData.teams = gameData.teams.filter(team => team !== null);

            // Remove team assignments from players if their team no longer exists
            const validTeamIds = gameData.teams.map(t => t.id);
            gameData.players.forEach(player => {
                if (player.teamId && !validTeamIds.includes(player.teamId)) {
                    player.teamId = null;
                }
            });

            // Record history if there were changes
            if (changes.length > 0) {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username;
                let historyMessage = `${actorDisplayName} updated team roster: `;
                const changeSummaries = changes.map(c => {
                    if (c.action === 'created') {
                        return `created "${c.name}"`;
                    } else if (c.action === 'renamed') {
                        return `renamed "${c.oldName}" to "${c.newName}"`;
                    }
                    return '';
                }).filter(s => s);
                historyMessage += changeSummaries.join(', ');

                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.TEAM,
                    GameDB.ACTION_TYPES.MODIFY,
                    historyMessage,
                    { changes }
                );
            }

            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

            const teamNames = gameData.teams.map(t => t.name).join(', ');
            await GameStatusHelper.sendGameStatus(interaction, interaction.client, gameData, {
                content: `Team roster updated. Active teams: ${teamNames || 'None'}`
            });
        }
    }
};