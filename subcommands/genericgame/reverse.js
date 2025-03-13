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

    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
    
    await interaction.editReply(
      await Formatter.createGameStatusReply(gameData, interaction.guild, {
        content: `Turn order has been ${gameData.reverseOrder ? 'reversed' : 'restored to normal'}`
      })
    )
  }
}

module.exports = new Reverse()
