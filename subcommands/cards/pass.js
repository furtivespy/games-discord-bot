const GameHelper = require('../../modules/GlobalGameHelper')
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')

class Pass {
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true })
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player){
            await interaction.editReply({ content: "You are not playing this game...", ephemeral: true })
            return
        }

        let selectedPlayer = interaction.options.getUser('target')
        let targetPlayer = find(gameData.players, {userId: selectedPlayer?.id})
        if (!targetPlayer || selectedPlayer.id === interaction.user.id) {
            await interaction.editReply({ content: "The selected player is not in this game or is yourself.", ephemeral: true })
            return
        }

        if (player.hands.main.length < 1) {
            await interaction.editReply({ content: "You have no cards to pass.", ephemeral: true })
            return
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('card')
            .setPlaceholder('Select cards to pass')
            .setMinValues(1)
            .setMaxValues(Math.min(player.hands.main.length, 15))
            .addOptions(
                Formatter.cardSort(player.hands.main).slice(0, 25).map(crd => 
                    ({label: Formatter.cardShortName(crd), value: crd.id})
                )  
            )

        const row = new ActionRowBuilder().addComponents(select)

        const CardsSelected = await interaction.editReply({ content: `Choose cards to pass to ${selectedPlayer.username}:`, components: [row], fetchReply: true })
        
        const filter = i => i.user.id === interaction.user.id && i.customId === 'card'
        let passedCards = []

        try {
            const collected = await CardsSelected.awaitMessageComponent({ filter, time: 60000 })
            passedCards = collected.values
        } catch (error) {
            return await interaction.editReply({ content: 'No cards selected', components: [] })
        }

        if (passedCards.length < 1){
            await interaction.editReply({ content: 'No cards selected', components: [] })
            return
        }
        await interaction.editReply({ content: `Passing ${passedCards.length} card(s) to ${selectedPlayer.username}...`, components: [] })  
        let passedCardsObjects = []
        passedCards.forEach(crd => {
            let card = find(player.hands.main, {id: crd})
            if (!card) { return }
            player.hands.main.splice(findIndex(player.hands.main, {id: crd}), 1)
            targetPlayer.hands.main.push(card)
            passedCardsObjects.push(card)
        })

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        // Public message: only number of cards
        const gameStatusReply = await Formatter.createGameStatusReply(
            gameData,
            interaction.guild,
            client.user.id,
            { content: `${interaction.member.displayName} passed ${passedCardsObjects.length} card(s) to ${selectedPlayer}.` }
        );
        await interaction.channel.send(gameStatusReply)

        // Private hand update for sender
        var senderHandInfo = await Formatter.playerSecretHandAndImages(gameData, player)
        if (senderHandInfo.attachments.length > 0){
            await interaction.followUp({ 
                content: `You passed ${passedCardsObjects.length} card(s) to ${selectedPlayer.username}.`,
                embeds: [...senderHandInfo.embeds],
                files: [...senderHandInfo.attachments],
                ephemeral: true
            })  
        } else {
            await interaction.followUp({ 
                content: `You passed ${passedCardsObjects.length} card(s) to ${selectedPlayer.username}.`,
                embeds: [...senderHandInfo.embeds],
                ephemeral: true
            })  
        }

        // Private hand update for receiver
        var receiverHandInfo = await Formatter.playerSecretHandAndImages(gameData, targetPlayer)
        if (receiverHandInfo.attachments.length > 0){
            await interaction.guild.members.fetch(selectedPlayer.id).then(member => {
                member.send({ 
                    content: `You received ${passedCardsObjects.length} card(s) from ${interaction.member.displayName}.`,
                    embeds: [...receiverHandInfo.embeds],
                    files: [...receiverHandInfo.attachments]
                }).catch(() => {})
            })
        } else {
            await interaction.guild.members.fetch(selectedPlayer.id).then(member => {
                member.send({ 
                    content: `You received ${passedCardsObjects.length} card(s) from ${interaction.member.displayName}.`,
                    embeds: [...receiverHandInfo.embeds]
                }).catch(() => {})
            })
        }
    }
}

module.exports = new Pass() 