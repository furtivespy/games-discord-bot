const GameHelper = require('../../modules/GlobalGameHelper')
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')

class Pick {
  async execute(interaction, client) {
    let gameData = await GameHelper.getGameData(client, interaction)

    if (interaction.isAutocomplete()) {
      GameHelper.getDeckAutocomplete(gameData, interaction)
    } else {
      const inputDeck = interaction.options.getString('deck')
      const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)
      let player = find(gameData.players, {userId: interaction.user.id})
      if (!player){
        await interaction.reply({ content: "Something is broken!?", ephemeral: true })
        return
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId('card')
        .setPlaceholder('Select cards to draw back into hand')
        .setMinValues(1)
        .setMaxValues(Math.min(deck.piles.discard.cards.length,15))
        .addOptions(
          Formatter.cardSort(deck.piles.discard.cards).map(crd => 
            ({label: Formatter.cardShortName(crd), value: crd.id})
          )  
        )

      const row = new ActionRowBuilder().addComponents(select)

      const CardsSelected = await interaction.reply({ content: `Choose cards to pick:`, components: [row], ephemeral: true, fetchReply: true })
      
      const filter = i => i.user.id === interaction.user.id && i.customId === 'card'
      let pickedCards = []

      try {
        const collected = await CardsSelected.awaitMessageComponent({ filter, time: 60000 })
        pickedCards = collected.values
      } catch (error) {
        return await interaction.editReply({ content: 'No cards selected', components: [] })
      }

      if (pickedCards.length < 1){
        await interaction.editReply({ content: 'No cards selected', components: [] })
        return
      } else {
        await interaction.editReply({ content: 'Cards Picked Back Up!', components: [] })
      }

      let pickedCardsObjects = []
      pickedCards.forEach(crd => {
        let card = find(deck.piles.discard.cards, {id: crd})
        if (!card) { return }
        deck.piles.discard.cards.splice(findIndex(deck.piles.discard.cards, {id: crd}), 1)
        player.hands.main.push(card)
        pickedCardsObjects.push(card)
      })

      await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

      let followup = await Formatter.multiCard(pickedCardsObjects, `Cards Picked Back Up by ${interaction.member.displayName}`)
      await interaction.followUp({ embeds: [followup[0]], files: [followup[1]] })    
    }
  }
}

module.exports = new Pick()