const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find, findIndex, remove, cloneDeep, shuffle } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')
const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')

class DeckPrune {
    async paginatedCardSelection(interaction, sortedCards, deckName) {
        const CARDS_PER_PAGE = 25
        const totalPages = Math.ceil(sortedCards.length / CARDS_PER_PAGE)
        let currentPage = 0
        let selectedCardIds = []

        while (true) {
            const startIdx = currentPage * CARDS_PER_PAGE
            const endIdx = Math.min(startIdx + CARDS_PER_PAGE, sortedCards.length)
            const pageCards = sortedCards.slice(startIdx, endIdx)

            // Build select menu for current page
            const select = new StringSelectMenuBuilder()
                .setCustomId('card')
                .setPlaceholder('Select cards to remove from this page')
                .setMinValues(0)
                .setMaxValues(pageCards.length)
                .addOptions(
                    pageCards.map(crd => {
                        const isSelected = selectedCardIds.includes(crd.id)
                        return {
                            label: `${isSelected ? '✓ ' : ''}${Formatter.cardShortName(crd)}`,
                            value: crd.id,
                            default: isSelected
                        }
                    })
                )

            const selectRow = new ActionRowBuilder().addComponents(select)

            // Build navigation buttons
            const buttons = []
            
            if (currentPage > 0) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('◀ Previous Page')
                        .setStyle(ButtonStyle.Secondary)
                )
            }
            
            if (currentPage < totalPages - 1) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next Page ▶')
                        .setStyle(ButtonStyle.Secondary)
                )
            }
            
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('done')
                    .setLabel(`✓ Done (${selectedCardIds.length} selected)`)
                    .setStyle(ButtonStyle.Success)
            )
            
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
            )

            const buttonRow = new ActionRowBuilder().addComponents(buttons)

            const components = [selectRow, buttonRow]
            const message = await interaction.editReply({
                content: `**Pruning "${deckName}"** - Page ${currentPage + 1}/${totalPages}\nShowing cards ${startIdx + 1}-${endIdx} of ${sortedCards.length}\nSelected so far: ${selectedCardIds.length} card(s)\n\nSelect cards from this page to remove:`,
                components: components,
                fetchReply: true
            })

            // Wait for user interaction
            const filter = i => i.user.id === interaction.user.id && ['card', 'prev', 'next', 'done', 'cancel'].includes(i.customId)
            
            try {
                const collected = await message.awaitMessageComponent({ filter, time: 120000 })
                
                if (collected.customId === 'card') {
                    // Update selection for current page
                    const newSelections = collected.values
                    
                    // Remove any deselected cards from this page
                    const pageCardIds = pageCards.map(c => c.id)
                    selectedCardIds = selectedCardIds.filter(id => !pageCardIds.includes(id) || newSelections.includes(id))
                    
                    // Add newly selected cards
                    newSelections.forEach(id => {
                        if (!selectedCardIds.includes(id)) {
                            selectedCardIds.push(id)
                        }
                    })
                    
                    await collected.deferUpdate()
                    
                } else if (collected.customId === 'prev') {
                    currentPage--
                    await collected.deferUpdate()
                    
                } else if (collected.customId === 'next') {
                    currentPage++
                    await collected.deferUpdate()
                    
                } else if (collected.customId === 'done') {
                    await collected.deferUpdate()
                    if (selectedCardIds.length === 0) {
                        await interaction.editReply({ 
                            content: 'No cards selected - deck unchanged', 
                            components: [] 
                        })
                        return null
                    }
                    return selectedCardIds
                    
                } else if (collected.customId === 'cancel') {
                    await collected.deferUpdate()
                    await interaction.editReply({ 
                        content: 'Pruning cancelled - deck unchanged', 
                        components: [] 
                    })
                    return null
                }
                
            } catch (error) {
                await interaction.editReply({ 
                    content: 'Selection timed out after 2 minutes - deck unchanged', 
                    components: [] 
                })
                return null
            }
        }
    }

    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            if (gameData.isdeleted || gameData.decks.length < 1){
                await interaction.respond([])
                return
            }
            await interaction.respond(gameData.decks.map(d => ({name: d.name, value: d.name})))
            return
        }

        await interaction.deferReply({ ephemeral: true })
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const inputDeck = interaction.options.getString('deck')
        const deck = gameData.decks.length == 1 ? gameData.decks[0] : find(gameData.decks, {name: inputDeck})
        
        if (!deck){
            await interaction.editReply({ content: `No Deck Found`, ephemeral: true })
            return
        }

        if (!deck.allCards || deck.allCards.length < 1) {
            await interaction.editReply({ content: `This deck has no cards to prune.`, ephemeral: true })
            return
        }

        // Create a sorted list of all cards in the deck for selection
        const sortedCards = Formatter.cardSort([...deck.allCards])
        
        // Use pagination to handle large decks
        let prunedCardIds = await this.paginatedCardSelection(interaction, sortedCards, deck.name)
        
        if (!prunedCardIds || prunedCardIds.length < 1){
            return
        }

        await interaction.editReply({ content: `Removing ${prunedCardIds.length} card(s) from ${deck.name}...`, components: [] })

        // Track which cards are being removed for history
        let prunedCardObjects = []
        prunedCardIds.forEach(cardId => {
            let card = find(deck.allCards, {id: cardId})
            if (card) {
                prunedCardObjects.push(card)
            }
        })

        // Remove cards from the allCards array
        remove(deck.allCards, card => prunedCardIds.includes(card.id))

        // Perform a recall: remove all cards from this deck from player hands/play areas and reshuffle
        gameData.players.forEach(player => {
            const removeCardsFromLocation = (locationArray) => {
                if (Array.isArray(locationArray)) {
                    remove(locationArray, card => card.origin === deck.name)
                }
            }

            if (player.hands) {
                removeCardsFromLocation(player.hands.main)
                removeCardsFromLocation(player.hands.draft)
                removeCardsFromLocation(player.hands.played)
                removeCardsFromLocation(player.hands.passed)
                removeCardsFromLocation(player.hands.received)
                removeCardsFromLocation(player.hands.simultaneous)
            }

            if (player.playArea) {
                removeCardsFromLocation(player.playArea)
            }
        })

        // Clear discard pile and reshuffle the deck with the new composition
        deck.piles.discard.cards = []
        deck.piles.draw.cards = cloneDeep(shuffle(deck.allCards))

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardNames = prunedCardObjects.map(c => Formatter.cardShortName(c)).join(', ')
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.MODIFY,
                `${actorDisplayName} pruned ${prunedCardObjects.length} cards from ${deck.name} and recalled/reshuffled the deck. Removed: ${cardNames}`,
                {
                    deckName: deck.name,
                    cardCount: prunedCardObjects.length,
                    cardIds: prunedCardObjects.map(c => c.id),
                    cardNames: cardNames,
                    newDeckSize: deck.allCards.length,
                    action: "deck prune"
                }
            )
        } catch (error) {
            console.warn('Failed to record deck prune in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
            content: `${interaction.member.displayName} removed ${prunedCardObjects.length} card(s) from the "${deck.name}" deck. All cards recalled and deck reshuffled. New deck size: ${deck.allCards.length} cards.`
        })

        // Send ephemeral follow-up showing which cards were removed
        let followup = await Formatter.multiCard(prunedCardObjects, `Cards Removed from ${deck.name}`)
        await interaction.followUp({ 
            embeds: [...followup[0]], 
            files: [...followup[1]],
            ephemeral: true 
        })
    }
}

module.exports = new DeckPrune()
