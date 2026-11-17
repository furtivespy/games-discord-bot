const GameHelper = require('../../modules/GlobalGameHelper')
const { setPlayerScore } = require('../../modules/gameLogic/playerScores')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class AddScore {
    async execute(interaction, client) {
        const [, gameData] = await Promise.all([
            interaction.deferReply(),
            GameHelper.getGameData(client, interaction)
        ])

        if (gameData.isdeleted) {
            await interaction.editReply({ 
                content: `No active game in this channel`})
            return
        }

        const targetPlayer = interaction.options.getUser('player') || interaction.user
        const score = interaction.options.getString('score')
        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        const targetDisplayName = interaction.guild.members.cache.get(targetPlayer.id)?.displayName || targetPlayer.username

        const result = setPlayerScore(gameData, {
            targetUserId: targetPlayer.id,
            score,
            actor: interaction.user,
            actorDisplayName,
            targetDisplayName,
            targetUsername: targetPlayer.username,
        })

        if (!result.ok) {
            await interaction.editReply({ 
                content: `${targetPlayer} is not in this game!`})
            return
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
            content: `Set ${targetPlayer}'s score to: ${score}`
        })
    }
}

module.exports = new AddScore()
