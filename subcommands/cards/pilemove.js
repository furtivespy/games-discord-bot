const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')

class PileMove {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true)
            const gameData = await GameHelper.getGameData(client, interaction)
            
            if (focusedOption.name === 'sourcepile') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedOption.value))
            } else if (focusedOption.name === 'destinationpile') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedOption.value))
            } else if (focusedOption.name === 'destinationplayer') {
                const players = gameData.players || []
                const focusedValue = focusedOption.value.toLowerCase()
                const matches = players
                    .filter(p => {
                        const member = interaction.guild.members.cache.get(p.userId)
                        const displayName = member?.displayName || p.name || `Player ${p.order}`
                        return displayName.toLowerCase().includes(focusedValue)
                    })
                    .slice(0, 25)
                    .map(p => {
                        const member = interaction.guild.members.cache.get(p.userId)
                        const displayName = member?.displayName || p.name || `Player ${p.order}`
                        return {
                            name: displayName,
                            value: p.userId
                        }
                    })
                await interaction.respond(matches)
            }
            return
        }

        await interaction.deferReply({ ephemeral: false })
        
        const gameData = await GameHelper.getGameData(client, interaction)
        
        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const player = find(gameData.players, {userId: interaction.user.id})
        if (!player) {
            await interaction.editReply({ content: "You must be a player in this game!", ephemeral: true })
            return
        }

        const sourcePileId = interaction.options.getString('sourcepile')
        const sourcePile = GameHelper.getGlobalPile(gameData, sourcePileId)
        
        if (!sourcePile) {
            await interaction.editReply({ content: `Source pile not found!`, ephemeral: true })
            return
        }

        if (sourcePile.cards.length < 1) {
            await interaction.editReply({ content: `No cards in ${sourcePile.name}!`, ephemeral: true })
            return
        }

        const destination = interaction.options.getString('destination')
        if (!destination) {
            await interaction.editReply({ content: "You must specify a destination.", ephemeral: true })
            return
        }

        const destinationPileId = interaction.options.getString('destinationpile')
        const destinationPlayerId = interaction.options.getString('destinationplayer')

        // Validate destination-specific requirements
        if (destination === 'pile' && !destinationPileId) {
            await interaction.editReply({ content: "You must specify a destination pile when destination is 'Custom Pile'.", ephemeral: true })
            return
        }

        if (destination === 'playarea' && !destinationPlayerId) {
            await interaction.editReply({ content: "You must specify a destination player when destination is 'Play Area'.", ephemeral: true })
            return
        }

        if (destination === 'playarea') {
            const destinationPlayer = find(gameData.players, { userId: destinationPlayerId })
            if (!destinationPlayer) {
                await interaction.editReply({ content: "Destination player not found in the game.", ephemeral: true })
                return
            }
        }

        if (destination === 'pile' && sourcePileId === destinationPileId) {
            await interaction.editReply({ content: "Cannot move cards to the same pile they came from.", ephemeral: true })
            return
        }

        // Card selection menu - show last 25 cards from pile
        const options = Formatter.cardSort(sourcePile.cards.slice(-25)).map((card, index) => ({
            label: Formatter.cardShortName(card).substring(0, 100),
            description: (card.description || `Card ${index + 1}`).substring(0, 100),
            value: card.id,
        }))

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('pile_move_select')
            .setPlaceholder(`Select card(s) to move from ${sourcePile.name}`)
            .setMinValues(1)
            .setMaxValues(Math.min(options.length, 25))
            .addOptions(options)

        const row = new ActionRowBuilder().addComponents(selectMenu)

        const selectionMessage = await interaction.editReply({
            content: `Which card(s) would you like to move from ${sourcePile.name}?`,
            components: [row],
            ephemeral: false
        })

        const collectorFilter = i => i.user.id === interaction.user.id && i.customId === 'pile_move_select'
        try {
            const selectionInteraction = await selectionMessage.awaitMessageComponent({ filter: collectorFilter, time: 120000 })

            const selectedCardIds = selectionInteraction.values
            const movedCards = []

            // Remove from source pile
            selectedCardIds.forEach(cardId => {
                const cardIndex = findIndex(sourcePile.cards, {id: cardId})
                if (cardIndex !== -1) {
                    const [card] = sourcePile.cards.splice(cardIndex, 1)
                    movedCards.push(card)
                }
            })

            if (movedCards.length === 0) {
                await selectionInteraction.update({ content: "No valid cards were selected or an error occurred.", components: [], ephemeral: true })
                return
            }

            let destinationName = ''
            let allMovesSuccessful = true

            // Handle different destinations
            if (destination === 'pile') {
                const destinationPile = GameHelper.getGlobalPile(gameData, destinationPileId)
                if (!destinationPile) {
                    // Return cards to source pile if destination pile not found
                    sourcePile.cards.push(...movedCards)
                    await selectionInteraction.update({ content: 'Destination pile not found! Cards returned to source pile.', components: [], ephemeral: true })
                    return
                }
                destinationPile.cards.push(...movedCards)
                destinationName = destinationPile.name
            } else if (destination === 'playarea') {
                const destinationPlayer = find(gameData.players, { userId: destinationPlayerId })
                if (!destinationPlayer) {
                    sourcePile.cards.push(...movedCards)
                    await selectionInteraction.update({ content: 'Destination player not found! Cards returned to source pile.', components: [], ephemeral: true })
                    return
                }
                if (!destinationPlayer.playArea) {
                    destinationPlayer.playArea = []
                }
                destinationPlayer.playArea.push(...movedCards)
                const destMember = interaction.guild.members.cache.get(destinationPlayerId)
                destinationName = destMember?.displayName || destinationPlayer.name || `Player ${destinationPlayer.order}`
                destinationName += "'s play area"
            } else if (destination === 'gameboard') {
                if (!gameData.gameBoard) {
                    gameData.gameBoard = []
                }
                gameData.gameBoard.push(...movedCards)
                destinationName = 'Game Board'
            } else if (destination === 'hand') {
                player.hands.main.push(...movedCards)
                destinationName = `${interaction.member.displayName}'s hand`
            } else if (destination === 'discard') {
                // Move to discard piles based on card origin
                for (const cardToDiscard of movedCards) {
                    let deck = find(gameData.decks, { name: cardToDiscard.origin })
                    if (deck && deck.piles && deck.piles.discard) {
                        deck.piles.discard.cards.push(cardToDiscard)
                    } else {
                        // Return card to source pile if discard pile not found
                        sourcePile.cards.push(cardToDiscard)
                        allMovesSuccessful = false
                        client.logger.log(`Error: Deck or discard pile not found for card origin '${cardToDiscard.origin}' in pile move. Card '${cardToDiscard.name}' returned to source pile.`, 'error')
                    }
                }
                destinationName = 'discard pile(s)'
            }

            // Record history
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                const successfullyMovedCards = movedCards.filter(c => !sourcePile.cards.find(pc => pc.id === c.id))
                const cardNames = sourcePile.isSecret ? undefined : successfullyMovedCards.map(c => Formatter.cardShortName(c)).join(', ')
                const summary = sourcePile.isSecret
                    ? `${actorDisplayName} moved ${successfullyMovedCards.length} cards from ${sourcePile.name} to ${destinationName}`
                    : `${actorDisplayName} moved ${successfullyMovedCards.length} cards from ${sourcePile.name} to ${destinationName}: ${cardNames}`
                
                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.CARD,
                    GameDB.ACTION_TYPES.TAKE,
                    summary,
                    {
                        sourcePileName: sourcePile.name,
                        sourcePileId: sourcePile.id,
                        isSecret: sourcePile.isSecret,
                        cardCount: successfullyMovedCards.length,
                        cardIds: successfullyMovedCards.map(c => c.id),
                        cardNames: sourcePile.isSecret ? undefined : cardNames,
                        source: sourcePile.name,
                        destination: destinationName,
                        destinationType: destination
                    }
                )
            } catch (error) {
                console.warn('Failed to record pile move in history:', error)
            }

            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

            const successfullyMovedCards = movedCards.filter(c => !sourcePile.cards.find(pc => pc.id === c.id))
            const movedCardsList = sourcePile.isSecret ? '' : successfullyMovedCards.map(c => Formatter.cardShortName(c)).join(', ')

            if (successfullyMovedCards.length > 0) {
                let publicMessage = `${interaction.member.displayName} moved ${successfullyMovedCards.length} card(s) from ${sourcePile.name} to ${destinationName}`
                if (!sourcePile.isSecret && successfullyMovedCards.length > 0 && movedCardsList.length < 500) {
                    publicMessage += `: ${movedCardsList}`
                }
                if (publicMessage.length > 2000) {
                    publicMessage = `${interaction.member.displayName} moved ${successfullyMovedCards.length} card(s) from ${sourcePile.name} to ${destinationName}. (Card list too long to display).`
                }
                
                await selectionInteraction.update({
                    content: publicMessage,
                    components: []
                })

                // Show updated hand privately if destination was hand
                if (destination === 'hand') {
                    const handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
                    const privateFollowup = { embeds: [...handInfo.embeds], ephemeral: true }
                    if (handInfo.attachments.length > 0) {
                        privateFollowup.files = [...handInfo.attachments]
                    }
                    await interaction.followUp(privateFollowup)
                }
            } else {
                await selectionInteraction.update({
                    content: `No cards were moved due to errors.`,
                    components: []
                })
            }

        } catch (e) {
            if (e.code === 'InteractionCollectorError') {
                await interaction.editReply({ content: 'Card selection timed out.', components: [], ephemeral: true })
            } else {
                client.logger.log(e, 'error')
                await interaction.editReply({ content: 'An error occurred during card selection for moving.', components: [], ephemeral: true })
            }
        }
    }
}

module.exports = new PileMove()
