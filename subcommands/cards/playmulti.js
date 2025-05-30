const GameHelper = require('../../modules/GlobalGameHelper')
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')

class PlayMulti {
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true })
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player){
            await interaction.editReply({ content: "Something is broken!?", ephemeral: true })
            return
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('card')
            .setPlaceholder('Select cards to play')
            .setMinValues(1)
            .setMaxValues(Math.min(player.hands.main.length, 15))
            .addOptions(
                Formatter.cardSort(player.hands.main).slice(0, 25).map(crd => 
                    ({label: Formatter.cardShortName(crd), value: crd.id})
                )  
            )

        const row = new ActionRowBuilder().addComponents(select)

        const CardsSelected = await interaction.editReply({ content: `Choose cards to play:`, components: [row], fetchReply: true })
        
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
        }
        await interaction.editReply({ content: `Playing ${playedCards.length} cards...`, components: [] })  
        let playedCardsObjects = []
        playedCards.forEach(crd => {
            let card = find(player.hands.main, {id: crd})
            if (!card) { return }
            let deck = find(gameData.decks, {name: card.origin})
            player.hands.main.splice(findIndex(player.hands.main, {id: crd}), 1)
            deck.piles.discard.cards.push(card)
            playedCardsObjects.push(card)
        })

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        let followup = await Formatter.multiCard(playedCardsObjects, `Cards Played by ${interaction.member.displayName}`)
        await interaction.followUp({ embeds: [...followup[0]], files: [...followup[1]], components: [] })
        
        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
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

module.exports = new PlayMulti()