const GameDB = require('../db/anygame.js')
const { cloneDeep } = require('lodash')

class GameHelper {

  static async getGameData(client, interaction) {
    return Object.assign(
      {},
      cloneDeep(GameDB.defaultGameData),
      await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
    )
  }

  static async getDeckAutocomplete(gameData, interaction) {
    if (gameData.isdeleted || gameData.decks.length < 1) {
      await interaction.respond([])
    } else {
      await interaction.respond(gameData.decks.map(d => ({ name: d.name, value: d.name })))
    }
  }

}


module.exports = GameHelper




