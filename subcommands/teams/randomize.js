const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { shuffle } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class Randomize {
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

        if (!gameData.players || gameData.players.length === 0) {
            await interaction.editReply({
                content: `No players in the game to randomize.`})
            return
        }

        // Shuffle the players
        const shuffledPlayers = shuffle([...gameData.players])
        
        // Distribute players evenly across teams
        const teamCount = gameData.teams.length
        shuffledPlayers.forEach((player, index) => {
            const teamIndex = index % teamCount
            player.teamId = gameData.teams[teamIndex].id
        })

        // Record history for randomization
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            // Create a summary of team assignments
            const teamAssignments = gameData.teams.map(team => {
                const playersOnTeam = gameData.players.filter(p => p.teamId === team.id)
                const playerNames = playersOnTeam.map(p => {
                    const member = interaction.guild.members.cache.get(p.userId)
                    return member?.displayName || p.name || p.userId
                }).join(', ')
                return `${team.name}: ${playerNames}`
            }).join(' | ')

            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.TEAM,
                GameDB.ACTION_TYPES.MODIFY,
                `${actorDisplayName} randomized team assignments`,
                {
                    teamAssignments: teamAssignments,
                    playerCount: gameData.players.length,
                    teamCount: teamCount,
                    actorUserId: interaction.user.id,
                    actorUsername: actorDisplayName
                }
            )
        } catch (error) {
            console.warn('Failed to record team randomization in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        // Build a message showing the team assignments
        let assignmentMessage = `Randomly assigned ${gameData.players.length} players to ${teamCount} teams:\n`
        gameData.teams.forEach(team => {
            const playersOnTeam = gameData.players.filter(p => p.teamId === team.id)
            const playerNames = playersOnTeam.map(p => {
                const member = interaction.guild.members.cache.get(p.userId)
                return member?.displayName || p.name || p.userId
            }).join(', ')
            assignmentMessage += `**${team.name}**: ${playerNames}\n`
        })

        await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
            content: assignmentMessage
        })
    }
}

module.exports = new Randomize()

