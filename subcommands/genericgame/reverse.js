const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Reverse {
  async execute(interaction, client) {
    await interaction.deferReply()

    let gameData = await GameHelper.getGameData(client, interaction)

    if (gameData.isdeleted) {
      await interaction.editReply({ 
        content: `No active game in this channel`, 
        ephemeral: true 
      })
      return
    }

    // Toggle reverse order
    gameData.reverseOrder = !gameData.reverseOrder

    // Record this action in game history
    try {
      const actorDisplayName = interaction.member?.displayName || interaction.user.username
      
      GameHelper.recordMove(
        gameData,
        interaction.user,
        GameDB.ACTION_CATEGORIES.GAME,
        GameDB.ACTION_TYPES.REVERSE,
        `${actorDisplayName} ${gameData.reverseOrder ? 'reversed' : 'restored'} the turn order`,
        {
          newOrder: gameData.reverseOrder ? 'reversed' : 'normal',
          previousOrder: gameData.reverseOrder ? 'normal' : 'reversed'
        },
        actorDisplayName
      )
    } catch (error) {
      console.warn('Failed to record reverse action in history:', error)
    }

    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
    
    await interaction.editReply(
      await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id, {
        content: `Turn order has been ${gameData.reverseOrder ? 'reversed' : 'restored to normal'}`
      })
    )
  }
}

module.exports = new Reverse()
