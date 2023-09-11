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
        await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
        return
      }
      let playerDeck = GameHelper.getSpecificDeck(gameData, null, interaction.user.id)
      let cardid = interaction.options.getString('card')

      let handCard = find(currentPlayer.hands.main, {id: cardid})
      let deckCard = find(playerDeck.allCards, {id: cardid})
      if (!handCard || !deckCard){
        await interaction.reply({ content: "Couldn't find card to remove", ephemeral: true })
        return
      }

      currentPlayer.hands.main.splice(findIndex(currentPlayer.hands.main, {id: cardid}), 1)
      playerDeck.allCards.splice(findIndex(playerDeck.allCards, {id: cardid}), 1)
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
              ephemeral: true
          })  
      } else {
          await interaction.followUp({ 
              embeds: [...handInfo.embeds],
              ephemeral: true
          })  
      }
    }
  }
}

module.exports = new Remove()