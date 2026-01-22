const GameDB = require('../db/anygame.js')
const GameFormatter = require('./GameFormatter')
const { cloneDeep, chain, find } = require("lodash");
const { nanoid } = require('nanoid');

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
   * Get global pile by ID or name
   * @param {Object} gameData - The game data object
   * @param {string} identifier - Pile ID or name
   * @returns {Object|null} The pile object or null if not found
   */
  static getGlobalPile(gameData, identifier) {
    if (!gameData.globalPiles || gameData.globalPiles.length === 0) {
      return null;
    }
    
    // Try to find by ID first, then by name
    return gameData.globalPiles.find(p => p.id === identifier) || 
           gameData.globalPiles.find(p => p.name === identifier);
  }

  /**
   * Create a new global pile
   * @param {Object} gameData - The game data object
   * @param {string} name - Name of the pile
   * @param {boolean} isSecret - Whether the pile is secret
   * @param {string} userId - User ID of creator
   * @returns {Object} The created pile
   */
  static createGlobalPile(gameData, name, isSecret, userId) {
    if (!gameData.globalPiles) {
      gameData.globalPiles = [];
    }

    const pile = cloneDeep(GameDB.defaultGlobalPile);
    pile.id = nanoid();
    pile.name = name;
    pile.isSecret = isSecret;
    pile.created = new Date().toISOString();
    pile.createdBy = userId;
    pile.cards = [];

    gameData.globalPiles.push(pile);
    return pile;
  }

  /**
   * Delete a global pile
   * @param {Object} gameData - The game data object
   * @param {string} pileId - ID of the pile to delete
   * @returns {boolean} True if deleted, false if not found
   */
  static deleteGlobalPile(gameData, pileId) {
    if (!gameData.globalPiles) {
      return false;
    }

    const index = gameData.globalPiles.findIndex(p => p.id === pileId);
    if (index === -1) {
      return false;
    }

    gameData.globalPiles.splice(index, 1);
    return true;
  }

  /**
   * Get autocomplete options for global piles
   * @param {Object} gameData - The game data object
   * @param {string} searchTerm - Current search term
   * @returns {Array} Array of autocomplete options
   */
  static getPileAutocomplete(gameData, searchTerm = '') {
    if (!gameData.globalPiles || gameData.globalPiles.length === 0) {
      return [];
    }

    return gameData.globalPiles
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(p => ({ name: p.name, value: p.id }))
      .slice(0, 25);
  }

  /**
   * Records a game action in the history log
   * @param {Object} gameData - The game data object to add history to
   * @param {Object} actor - The user who performed the action (must have id and username)
   * @param {string} actionCategory - Category of action (use GameDB.ACTION_CATEGORIES)
   * @param {string} actionType - Type of action (use GameDB.ACTION_TYPES) 
   * @param {string} summary - Human-readable description of what happened
   * @param {Object} details - Optional additional data for analysis/filtering
   * @param {string} displayName - Guild display name for the actor (fallback to username if not provided)
   * @throws {Error} If required parameters are missing or invalid
   */
  static recordMove(gameData, actor, actionCategory, actionType, summary, details = {}, displayName = null) {
    // Input validation
    if (!gameData) {
      throw new Error('GameData is required for history recording')
    }
    
    if (!actor || !actor.id || !actor.username) {
      throw new Error('Actor must have valid id and username properties')
    }
    
    if (!actionCategory || typeof actionCategory !== 'string') {
      throw new Error('ActionCategory must be a non-empty string')
    }
    
    if (!actionType || typeof actionType !== 'string') {
      throw new Error('ActionType must be a non-empty string')  
    }
    
    if (!summary || typeof summary !== 'string') {
      throw new Error('Summary must be a non-empty string')
    }

    // Validate action category against known categories
    const validCategories = Object.values(GameDB.ACTION_CATEGORIES)
    if (!validCategories.includes(actionCategory)) {
      console.warn(`Warning: Unknown action category '${actionCategory}'. Valid categories: ${validCategories.join(', ')}`)
    }

    try {
      const entry = {
        id: nanoid(),
        timestamp: new Date().toISOString(),
        actor: {
          userId: actor.id,
          username: actor.username,
          displayName: displayName || actor.username // Use displayName if provided, fallback to username
        },
        action: {
          category: actionCategory,
          type: actionType
        },
        summary: summary,
        details: details
      }
      
      // Initialize history array if it doesn't exist
      if (!gameData.history) {
        gameData.history = []
      }
      
      gameData.history.push(entry)
      
      // Keep last 500 entries to prevent unbounded growth
      if (gameData.history.length > 500) {
        gameData.history = gameData.history.slice(-500)
      }
      
    } catch (error) {
      console.error('Error recording game history:', error)
      throw new Error(`Failed to record game history: ${error.message}`)
    }
  }
}


module.exports = GameHelper




