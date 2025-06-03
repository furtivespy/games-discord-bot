const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { find, cloneDeep, shuffle } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
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

      await client.setGameDataV2(
        interaction.guildId,
        "game",
        interaction.channelId,
        gameData
      );


      await interaction.editReply(
        await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id,
          { content: `Added and shuffled the new decks` }
        )
      );

    }
  }
}
    
module.exports = new builderNew()


