const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const Formatter = require('../../modules/GameFormatter')
const { find } = require('lodash')


class Add {
  async execute(interaction, client) {

    let gameData = await GameHelper.getGameData(client, interaction)
    let supplyDeck = gameData.decks.find(d => d.name.startsWith("Supply-"))

    if (interaction.isAutocomplete()) {
      if (gameData.isdeleted || !supplyDeck){
        await interaction.respond([])
        return
      }
      await interaction.respond(
        GameHelper.getCardsAutocomplete(interaction.options.getString('card'), supplyDeck.allCards)
      );
    } else {

      if (gameData.isdeleted || !supplyDeck) {
          await interaction.reply({ content: `There is no game or deckbuilder in this channel.`, ephemeral: true })
          return
      }

      const playerDeck = GameHelper.getSpecificDeck(gameData, null, interaction.user.id)
      const cardid = interaction.options.getString('card')
      const card = find(supplyDeck.allCards, {id: cardid})

      if (!card || !playerDeck){
          await interaction.reply({ content: "Something is broken!?", ephemeral: true })
          return
      }

      await interaction.deferReply();
      const newCard = GameDB.createCardFromObj(playerDeck.name, card.format, card)

      playerDeck.allCards.push(newCard)
      playerDeck.piles.discard.cards.push(newCard)
         
      await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
      
      await interaction.editReply({ 
        content: `${interaction.member.displayName} has Added:`,
        embeds: [
            Formatter.oneCard(newCard),
            ...Formatter.deckStatus2(gameData)
        ]}
      )
    }
  }
}


module.exports = new Add()