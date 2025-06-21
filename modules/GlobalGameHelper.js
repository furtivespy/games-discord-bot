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

  /**
   * Handles playing a card for a player.
   * Moves the card from the player's hand to either their play area or the deck's discard pile.
   * @param {object} gameData - The overall game data object.
   * @param {object} player - The player object who is playing the card.
   * @param {object} cardToPlay - The card object to be played.
   * @param {string} handId - The ID of the hand the card is coming from (e.g., 'main').
   * @param {object} deck - The deck object from which the card originated, for discard pile access.
   * @returns {boolean} True if the card was successfully played, false otherwise.
   */
  static handlePlayCard(gameData, player, cardToPlay, handId = 'main', deck) {
    if (!player || !cardToPlay || !deck) {
      console.error("handlePlayCard: Missing player, cardToPlay, or deck parameter.");
      return false;
    }

    const hand = player.hands[handId];
    if (!hand) {
      console.error(`handlePlayCard: Hand '${handId}' not found for player.`);
      return false;
    }

    const cardIndex = hand.cards.findIndex(c => c.id === cardToPlay.id);
    if (cardIndex === -1) {
      console.error(`handlePlayCard: Card with id ${cardToPlay.id} not found in player's hand '${handId}'.`);
      return false;
    }

    // Remove card from hand
    const [playedCard] = hand.cards.splice(cardIndex, 1);

    if (gameData.playToPlayArea) {
      if (!player.playArea) { // Should have been initialized by defaultPlayer
        player.playArea = [];
      }
      player.playArea.push(playedCard);
    } else {
      if (!deck.piles || !deck.piles.discard) {
        console.error("handlePlayCard: Deck discard pile is not properly initialized.");
        // Potentially add it back to hand or handle error more gracefully
        hand.cards.splice(cardIndex, 0, playedCard); // Add back if error
        return false;
      }
      deck.piles.discard.cards.push(playedCard);
    }
    return true;
  }
}


module.exports = GameHelper




