const GameDB = require('../db/anygame.js')
const GameFormatter = require('./GameFormatter')
const { cloneDeep, chain, find } = require("lodash");

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

  static getCardLists(searchTerm) {
    return chain(GameDB.CurrentCardList)
      .filter(cl => cl[0].toLowerCase().includes(searchTerm.toLowerCase()))
      .sortBy(cl => cl[0])
      .map(cl => ({ name: cl[0], value: cl[1] }))
      .slice(0, 25)
      .value()
  }

  static getCardsAutocomplete(searchTerm, cardList) {
    return chain(cardList)
      .filter(crd => GameFormatter.cardLongName(crd).toLowerCase().includes(searchTerm.toLowerCase()))
      .sortBy(['suit', 'value', 'name'])
      .map(crd => ({ name: GameFormatter.cardShortName(crd), value: crd.id }))
      .slice(0, 25)
      .value()      
  }

  static getSpecificDeck(gameData, deckName, userId) {
    if (gameData.decks.length == 1) {
      return gameData.decks[0]
    } else if (deckName && deckName.length > 0) {
      return find(gameData.decks, { name: deckName })
    } else {
      return find(gameData.decks, { id: userId })
    }
  }
}


module.exports = GameHelper




