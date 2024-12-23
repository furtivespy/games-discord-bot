//Alerts the next player in turn order that it is their turn
const GameHelper = require('../../modules/GlobalGameHelper')
const { find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Next {
  async execute(interaction, client) {

    await interaction.deferReply()

    let gameData = await GameHelper.getGameData(client, interaction)

    if (gameData.isdeleted) {
      await interaction.editReply({
        content: `No game in progress`,
        ephemeral: true
      })
      return
    }

    let player = find(gameData.players, {userId: interaction.user.id})
    if (!player){
      await interaction.editReply({
        content: `You're not playing in this game!`,
        ephemeral: true
      })
      return
    }

    let next;
    if (gameData.reverseOrder) {
      next = find(gameData.players, {order: player.order - 1})
      if (!next) {
        next = find(gameData.players, {order: gameData.players.length - 1})
      }
    } else {
      next = find(gameData.players, {order: player.order + 1})
      if (!next) {
        next = find(gameData.players, {order: 0})
      }
    }

    if (!next){
      await interaction.editReply({
        content: `Something went wrong!`,
        ephemeral: true
      })
      return
    }

    await interaction.editReply({
      content: `<@${next.userId}>, it's your turn!`,
    })
  }
}

module.exports = new Next()