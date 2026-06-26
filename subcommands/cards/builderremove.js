const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const Formatter = require('../../modules/GameFormatter')
const { find, findIndex } = require('lodash')


class Remove {
  async execute(interaction, client) {
    let gameData = await GameHelper.getGameData(client, interaction)
    let currentPlayer = find(gameData.players, {userId: interaction.user.id})

    if (interaction.isAutocomplete()) {
      if (gameData.isdeleted || !currentPlayer){
        await interaction.respond([])
        return
      }
      await interaction.respond(
        GameHelper.getCardsAutocomplete(interaction.options.getString('card'), currentPlayer.hands.main)
      );
    } else {

      if (gameData.isdeleted) {
        await interaction.reply({ content: `There is no game in this channel.`, flags: MessageFlags.Ephemeral })
        return
      }
      let playerDeck = GameHelper.getSpecificDeck(gameData, null, interaction.user.id)
      let cardid = interaction.options.getString('card')

      let handCard = find(currentPlayer.hands.main, {id: cardid})
      let deckCard = find(playerDeck.allCards, {id: cardid})
      if (!handCard || !deckCard){
        await interaction.reply({ content: "Couldn't find card to remove", flags: MessageFlags.Ephemeral })
        return
      }

      currentPlayer.hands.main.splice(findIndex(currentPlayer.hands.main, {id: cardid}), 1)
      playerDeck.allCards.splice(findIndex(playerDeck.allCards, {id: cardid}), 1)
      
      // Record history for builder card removal
      try {
          const actorDisplayName = interaction.member?.displayName || interaction.user.username
          const cardName = Formatter.cardShortName(handCard)
          
          GameHelper.recordMove(
              gameData,
              interaction.user,
              GameDB.ACTION_CATEGORIES.CARD,
              GameDB.ACTION_TYPES.REMOVE,
              `${actorDisplayName} removed ${cardName} from their deck`,
              {
                  cardId: handCard.id,
                  cardName: cardName,
                  playerDeckName: playerDeck.name,
                  playerUserId: interaction.user.id,
                  playerUsername: actorDisplayName,
                  newDeckSize: playerDeck.allCards.length,
                  action: "remove card from personal deck"
              }
          )
      } catch (error) {
          console.warn('Failed to record builder remove in history:', error)
      }
      
      await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
      await interaction.reply(
        { 
          content: `${interaction.member.displayName} has Removed:`,
          embeds: [
            Formatter.oneCard(handCard),
            ...Formatter.deckStatus2(gameData)
          ]
        }
      )
      var handInfo = await Formatter.playerSecretHandAndImages(gameData, currentPlayer)
      if (handInfo.attachments.length >0){
          await interaction.followUp({ 
              embeds: [...handInfo.embeds],
              files: [...handInfo.attachments],
              flags: MessageFlags.Ephemeral
          })  
      } else {
          await interaction.followUp({ 
              embeds: [...handInfo.embeds],
              flags: MessageFlags.Ephemeral
          })  
      }
    }
  }
}

module.exports = new Remove()