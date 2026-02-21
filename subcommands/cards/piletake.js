const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const {find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags} = require('discord.js')

class PileTake {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const gameData = await GameHelper.getGameData(client, interaction)
            const focusedValue = interaction.options.getString('pile')
            await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedValue))
            return
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        
        const gameData = await GameHelper.getGameData(client, interaction)
        const pileId = interaction.options.getString('pile')
        
        const player = find(gameData.players, {userId: interaction.user.id})
        
        if (!player) {
            await interaction.editReply({ content: "Something is broken!?"})
            return
        }

        const pile = GameHelper.getGlobalPile(gameData, pileId)
        if (!pile) {
            await interaction.editReply({ content: `Pile not found!`})
            return
        }

        if (pile.cards.length < 1) {
            await interaction.editReply({ content: `No cards in ${pile.name}!`})
            return
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('card')
            .setPlaceholder('Select cards to take into hand')
            .setMinValues(1)
            .setMaxValues(Math.min(pile.cards.length, 15))
            .addOptions(
                Formatter.cardSort(pile.cards.slice(-25)).map(crd => 
                    ({label: Formatter.cardShortName(crd), value: crd.id})
                )  
            )

        const row = new ActionRowBuilder().addComponents(select)

        const CardsSelected = await interaction.editReply({ 
            content: `Choose cards to take from ${pile.name}:`, 
            components: [row],  
            fetchReply: true 
        })
        
        const filter = i => i.user.id === interaction.user.id && i.customId === 'card'
        let takenCards = []

        try {
            const collected = await CardsSelected.awaitMessageComponent({ filter, time: 60000 })
            takenCards = collected.values
        } catch (error) {
            return await interaction.editReply({ content: 'No cards selected', components: [] })
        }

        if (takenCards.length < 1) {
            await interaction.editReply({ content: 'No cards selected', components: [] })
            return
        } else {
            await interaction.editReply({ content: 'Cards Taken!', components: [] })
        }

        let takenCardObjects = []
        takenCards.forEach(crd => {
            let card = find(pile.cards, {id: crd})
            if (!card) { return }
            pile.cards.splice(findIndex(pile.cards, {id: crd}), 1)
            player.hands.main.push(card)
            takenCardObjects.push(card)
        })

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardNames = pile.isSecret ? undefined : takenCardObjects.map(c => Formatter.cardShortName(c)).join(', ')
            const summary = pile.isSecret
                ? `${actorDisplayName} took ${takenCardObjects.length} cards from ${pile.name}`
                : `${actorDisplayName} took ${takenCardObjects.length} cards from ${pile.name}: ${cardNames}`
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.TAKE,
                summary,
                {
                    pileName: pile.name,
                    pileId: pile.id,
                    isSecret: pile.isSecret,
                    cardCount: takenCardObjects.length,
                    cardIds: takenCardObjects.map(c => c.id),
                    cardNames: pile.isSecret ? undefined : cardNames,
                    source: pile.name,
                    destination: "hand"
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record pile take in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        let followup = await Formatter.multiCard(takenCardObjects, `Cards Taken by ${interaction.member.displayName}`)
        await interaction.followUp({ embeds: [...followup[0]], files: [...followup[1]] })
    }
}

module.exports = new PileTake()
