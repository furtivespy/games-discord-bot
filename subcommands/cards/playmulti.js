const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')

class PlayMulti {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId) 
            //await client.getGameData(`game-${interaction.channel.id}`)
        )

        if (gameData.isdeleted) {
            await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player){
            await interaction.reply({ content: "Something is broken!?", ephemeral: true })
            return
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('card')
            .setPlaceholder('Select cards to play')
            .setMinValues(1)
            .setMaxValues(player.hands.main.length)
            .addOptions(
              Formatter.cardSort(player.hands.main).map(crd => 
                ({label: Formatter.cardShortName(crd), value: crd.id})
              )  
            )

        const row = new ActionRowBuilder()
            .addComponents(select)

        const CardsSelected = await interaction.reply({ content: `Choose cards to play:`, components: [row], ephemeral: true, fetchReply: true })
        
        const filter = i => i.user.id === interaction.user.id && i.customId === 'card'
        let playedCards = []

        try {
          const collected = await CardsSelected.awaitMessageComponent({ filter, time: 60000 })
          playedCards = collected.values
        } catch (error) {
          return await interaction.editReply({ content: 'No cards selected', components: [] })
        }

        if (playedCards.length < 1){
            await interaction.editReply({ content: 'No cards selected', components: [] })
            return
        } else {
          await interaction.editReply({ content: 'Cards Played!', components: [] })
        }
        await interaction.followUp({ content: `If this command worked, you would have played cards with these IDs: ${JSON.stringify(playedCards)}` })
                
    }
}


module.exports = new PlayMulti()