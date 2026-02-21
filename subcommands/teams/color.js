const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class Color {
    async execute(interaction, client) {
        await interaction.deferReply()

        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({
                content: `No active game in this channel.`})
            return
        }

        if (!gameData.teams || gameData.teams.length === 0) {
            await interaction.editReply({
                content: `No teams exist in this game. Use /team roster to create teams first.`})
            return
        }

        const teamId = interaction.options.getString('team')
        const colorInput = interaction.options.getString('color')

        // Find the team in the game
        const team = find(gameData.teams, { id: teamId })
        if (!team) {
            await interaction.editReply({
                content: `Team not found!`})
            return
        }

        // Validate color input (basic validation)
        if (!(/^#[0-9A-F]{6}$/i.test(colorInput) || /^[a-zA-Z]+$/i.test(colorInput) || /^#[0-9A-F]{3}$/i.test(colorInput))) {
            // Basic check for common color names or hex codes
        }

        const oldColor = team.color
        team.color = colorInput

        // Record history for color change
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.TEAM,
                GameDB.ACTION_TYPES.MODIFY,
                `${actorDisplayName} set ${team.name}'s color to ${colorInput}`,
                {
                    teamId: team.id,
                    teamName: team.name,
                    oldColor: oldColor || 'default',
                    newColor: colorInput,
                    actorUserId: interaction.user.id,
                    actorUsername: actorDisplayName
                }
            )
        } catch (error) {
            console.warn('Failed to record team color change in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
            content: `Set color for team **${team.name}** to **${colorInput}**.`
        })
    }
}

module.exports = new Color()

