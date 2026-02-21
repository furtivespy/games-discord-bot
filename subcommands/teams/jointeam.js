const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class JoinTeam {
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
        const targetUser = interaction.options.getUser('player') || interaction.user

        // Find the team in the game
        const team = find(gameData.teams, { id: teamId })
        if (!team) {
            await interaction.editReply({
                content: `Team not found!`})
            return
        }

        // Find the player in the game
        const player = find(gameData.players, { userId: targetUser.id })
        if (!player) {
            await interaction.editReply({
                content: `${targetUser} is not in this game!`})
            return
        }

        const oldTeamId = player.teamId
        const oldTeam = oldTeamId ? find(gameData.teams, { id: oldTeamId }) : null
        
        player.teamId = teamId

        // Record history for team assignment
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const targetPlayerName = interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username
            
            const summary = oldTeam 
                ? `${actorDisplayName} moved ${targetPlayerName} from ${oldTeam.name} to ${team.name}`
                : `${actorDisplayName} assigned ${targetPlayerName} to ${team.name}`

            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.TEAM,
                GameDB.ACTION_TYPES.MODIFY,
                summary,
                {
                    targetUserId: targetUser.id,
                    targetUsername: targetPlayerName,
                    teamId: team.id,
                    teamName: team.name,
                    oldTeamId: oldTeamId,
                    oldTeamName: oldTeam ? oldTeam.name : null,
                    actorUserId: interaction.user.id,
                    actorUsername: actorDisplayName
                }
            )
        } catch (error) {
            console.warn('Failed to record team assignment in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const message = oldTeam 
            ? `Moved ${targetUser.username} from **${oldTeam.name}** to **${team.name}**.`
            : `Assigned ${targetUser.username} to **${team.name}**.`

        await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
            content: message
        })
    }
}

module.exports = new JoinTeam()

