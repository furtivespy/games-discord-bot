const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { find, cloneDeep, shuffle } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')
const haiku = require('haikunator')

class builderNew {
  async execute(interaction, client) {

    let gameData = await GameHelper.getGameData(client, interaction)

    if (interaction.isAutocomplete()) {
      const searchField = interaction.options.getFocused(true).name
      let searchTerm = interaction.options.getString(searchField)

      await interaction.respond(
        GameHelper.getCardLists(searchTerm)
      );

    } else {
      if (gameData.isdeleted) {
        await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
        return
      }
      await interaction.deferReply();
      const inputSet = interaction.options.getString("basecardset");
      const allCardSet = interaction.options.getString("supplyset");

      for (const player of gameData.players) {
        let deckName = interaction.guild.members.cache.get(player.userId)?.displayName ?? player.name
        if (find(gameData.decks, { name: deckName })) {
          continue
        }
        let newDeck = Object.assign({}, cloneDeep(GameDB.defaultDeck), {
          name: deckName,
          id: player.userId,
        });
        newDeck.allCards = GameDB.MakeSpecificDeck(deckName, inputSet);
        newDeck.piles.draw.cards = cloneDeep(shuffle(newDeck.allCards));
        gameData.decks.push(newDeck);
      }

      const h = new haiku();

      let newDeck = Object.assign({}, cloneDeep(GameDB.defaultDeck), {
        name: `Supply-${h.haikunate({tokenLength: 0})}`,
      });
      newDeck.allCards = GameDB.MakeSpecificDeck("Supply", allCardSet);
      newDeck.piles.draw.cards = cloneDeep(shuffle(newDeck.allCards));
      gameData.decks.push(newDeck);

      // Record history for builder setup
      try {
          const actorDisplayName = interaction.member?.displayName || interaction.user.username
          const playerDecks = []
          const supplyDeck = gameData.decks.find(d => d.name.startsWith('Supply-'))
          
          gameData.players.forEach(player => {
              const deckName = interaction.guild.members.cache.get(player.userId)?.displayName || player.name
              const deck = find(gameData.decks, { name: deckName })
              if (deck) {
                  playerDecks.push({
                      userId: player.userId,
                      deckName: deckName,
                      cardCount: deck.allCards.length
                  })
              }
          })
          
          GameHelper.recordMove(
              gameData,
              interaction.user,
              GameDB.ACTION_CATEGORIES.CARD,
              GameDB.ACTION_TYPES.CREATE,
              `${actorDisplayName} created builder environment: ${playerDecks.length} player decks + supply deck`,
              {
                  baseCardSet: inputSet,
                  supplyCardSet: allCardSet,
                  playerDecks: playerDecks,
                  supplyDeckName: supplyDeck ? supplyDeck.name : 'Unknown',
                  supplyCardCount: supplyDeck ? supplyDeck.allCards.length : 0,
                  playersReceived: playerDecks.length,
                  action: "builder environment setup"
              }
          )
      } catch (error) {
          console.warn('Failed to record builder new in history:', error)
      }

      await client.setGameDataV2(
        interaction.guildId,
        "game",
        interaction.channelId,
        gameData
      );

      await GameStatusHelper.sendGameStatus(interaction, client, gameData,
        { content: `Added and shuffled the new decks` }
      );
    }
  }
}
    
module.exports = new builderNew()