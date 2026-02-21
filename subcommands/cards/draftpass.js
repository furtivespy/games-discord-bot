const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { cloneDeep, orderBy } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class Pass {
    async execute(interaction, client) {
        await interaction.deferReply()
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        const inputDir = interaction.options.getString('direction')
        if (inputDir != 'asc' && inputDir != 'desc') {
            await interaction.editReply({ content: `I don't know how to pass in that direction`})
            return
        }

        //Do Stuff
        let playerOne = null
        let PrevHand = null
        orderBy(gameData.players, ['order'], [inputDir]).forEach(play => {
            if (playerOne == null) {
                playerOne = play
                PrevHand = play.hands.draft
                return
            }
            const currentHand = play.hands.draft
            play.hands.draft = PrevHand
            PrevHand = currentHand
        })
        playerOne.hands.draft = PrevHand

        // Record history for draft pass affecting all players
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const direction = inputDir === 'asc' ? 'clockwise' : 'counter-clockwise'
            const playerInfo = []
            
            gameData.players.forEach(player => {
                const displayName = interaction.guild.members.cache.get(player.userId)?.displayName || player.name || player.userId
                playerInfo.push({
                    userId: player.userId,
                    displayName: displayName,
                    draftHandSize: player.hands.draft?.length || 0
                })
            })
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.PASS,
                `${actorDisplayName} passed draft hands ${direction} to all players`,
                {
                    direction: direction,
                    directionCode: inputDir,
                    playersAffected: gameData.players.length,
                    playerInfo: playerInfo,
                    action: "draft hand rotation"
                }
            )
        } catch (error) {
            console.warn('Failed to record draft pass in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        let content = `New Draft Round Has Started! Draft Round Passed ${inputDir == 'asc' ? 'Clockwise' : 'Counter-Clockwise'}\n`
        gameData.players.forEach(play => { content += `<@${play.userId}> ` })
        
        await GameStatusHelper.sendGameStatus(interaction, client, gameData,
          { content: content }
        );
    }
}

module.exports = new Pass()