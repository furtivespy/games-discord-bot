const { MessageFlags } = require("discord.js");
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
          await interaction.reply({ content: `There is no game or deckbuilder in this channel.`, flags: MessageFlags.Ephemeral })
          return
      }

      const playerDeck = GameHelper.getSpecificDeck(gameData, null, interaction.user.id)
      const cardid = interaction.options.getString('card')
      const card = find(supplyDeck.allCards, {id: cardid})

      if (!card || !playerDeck){
          await interaction.reply({ content: "Something is broken!?", flags: MessageFlags.Ephemeral })
          return
      }

      await interaction.deferReply();
      const newCard = GameDB.createCardFromObj(playerDeck.name, card.format, card)

      playerDeck.allCards.push(newCard)
      playerDeck.piles.discard.cards.push(newCard)
      
      // Record history for builder card addition
      try {
          const actorDisplayName = interaction.member?.displayName || interaction.user.username
          const cardName = Formatter.cardShortName(newCard)
          
          GameHelper.recordMove(
              gameData,
              interaction.user,
              GameDB.ACTION_CATEGORIES.CARD,
              GameDB.ACTION_TYPES.ADD,
              `${actorDisplayName} added ${cardName} to their deck`,
              {
                  cardId: newCard.id,
                  cardName: cardName,
                  playerDeckName: playerDeck.name,
                  playerUserId: interaction.user.id,
                  playerUsername: actorDisplayName,
                  newDeckSize: playerDeck.allCards.length,
                  action: "add card to personal deck"
              }
          )
      } catch (error) {
          console.warn('Failed to record builder add in history:', error)
      }
         
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