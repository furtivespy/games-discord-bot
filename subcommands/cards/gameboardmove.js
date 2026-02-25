const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find, findIndex, sortBy, filter } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')

class GameBoardMove {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true)
            const gameData = await GameHelper.getGameData(client, interaction)
            
            if (focusedOption.name === 'destination') {
                await interaction.respond(GameHelper.getDestinationAutocomplete(gameData, focusedOption.value, ['hand', 'playarea', 'discard', 'pile']))
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

        if (!gameData.gameBoard || gameData.gameBoard.length < 1) {
            await interaction.editReply({ content: `No cards on the Game Board!`, ephemeral: true })
            return
        }

        const destination = interaction.options.getString('destination')
        if (!destination) {
            await interaction.editReply({ content: "You must specify a destination.", ephemeral: true })
            return
        }

        const destinationPlayerId = interaction.options.getString('destinationplayer')

        // Validate destination-specific requirements
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

        // Card selection menu
        const options = gameData.gameBoard.map((card, index) => ({
            label: Formatter.cardShortName(card).substring(0, 100),
            description: (card.description || `Card at position ${index + 1}`).substring(0, 100),
            value: card.id,
        }))

        if (options.length > 25) {
            await interaction.editReply({ content: `Game Board has too many cards to display in a single list. Only the first 25 are shown.`, ephemeral: true })
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('gameboard_move_select')
            .setPlaceholder('Select card(s) to move from Game Board')
            .setMinValues(1)
            .setMaxValues(Math.min(options.length, 25))
            .addOptions(options.slice(0, 25))

        const row = new ActionRowBuilder().addComponents(selectMenu)

        const selectionMessage = await interaction.editReply({
            content: 'Which card(s) would you like to move from Game Board?',
            components: [row],
            ephemeral: false
        })

        const collectorFilter = i => i.user.id === interaction.user.id && i.customId === 'gameboard_move_select'
        try {
            const selectionInteraction = await selectionMessage.awaitMessageComponent({ filter: collectorFilter, time: 120000 })

            const selectedCardIds = selectionInteraction.values
            const movedCards = []

            // Remove from gameBoard and collect moved cards
            const newGameBoard = []
            gameData.gameBoard.forEach(card => {
                if (selectedCardIds.includes(card.id)) {
                    movedCards.push(card)
                } else {
                    newGameBoard.push(card)
                }
            })
            gameData.gameBoard = newGameBoard

            if (movedCards.length === 0) {
                await selectionInteraction.update({ content: "No valid cards were selected or an error occurred.", components: [], ephemeral: true })
                return
            }

            let destinationName = ''
            let allMovesSuccessful = true

            // Handle different destinations
            if (destination === 'playarea') {
                const destinationPlayer = find(gameData.players, { userId: destinationPlayerId })
                if (!destinationPlayer) {
                    gameData.gameBoard.push(...movedCards)
                    await selectionInteraction.update({ content: 'Destination player not found! Cards returned to Game Board.', components: [], ephemeral: true })
                    return
                }
                if (!destinationPlayer.playArea) {
                    destinationPlayer.playArea = []
                }
                destinationPlayer.playArea.push(...movedCards)
                const destMember = interaction.guild.members.cache.get(destinationPlayerId)
                destinationName = destMember?.displayName || destinationPlayer.name || `Player ${destinationPlayer.order}`
                destinationName += "'s play area"
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
                        // Return card to gameboard if discard pile not found
                        gameData.gameBoard.push(cardToDiscard)
                        allMovesSuccessful = false
                        client.logger.log(`Error: Deck or discard pile not found for card origin '${cardToDiscard.origin}' in gameboard move. Card '${cardToDiscard.name}' returned to Game Board.`, 'error')
                    }
                }
                destinationName = 'discard pile(s)'
            } else {
                // Assume pile
                const pile = GameHelper.getGlobalPile(gameData, destination)
                if (!pile) {
                    // Return cards to gameboard if pile not found
                    gameData.gameBoard.push(...movedCards)
                    await selectionInteraction.update({ content: 'Pile not found! Cards returned to Game Board.', components: [], ephemeral: true })
                    return
                }
                pile.cards.push(...movedCards)
                destinationName = pile.name
            }

            // Record history
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                const successfullyMovedCards = movedCards.filter(c => !gameData.gameBoard.find(gc => gc.id === c.id))
                const cardNames = successfullyMovedCards.map(c => Formatter.cardShortName(c)).join(', ')
                
                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.CARD,
                    GameDB.ACTION_TYPES.TAKE,
                    `${actorDisplayName} moved ${successfullyMovedCards.length} cards from Game Board to ${destinationName}: ${cardNames}`,
                    {
                        cardCount: successfullyMovedCards.length,
                        cardIds: successfullyMovedCards.map(c => c.id),
                        cardNames: cardNames,
                        source: "Game Board",
                        destination: destinationName,
                        destinationType: destination
                    }
                )
            } catch (error) {
                console.warn('Failed to record game board move in history:', error)
            }

            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

            const successfullyMovedCards = movedCards.filter(c => !gameData.gameBoard.find(gc => gc.id === c.id))
            const movedCardsList = successfullyMovedCards.map(c => Formatter.cardShortName(c)).join(', ')

            if (successfullyMovedCards.length > 0) {
                let publicMessage = `${interaction.member.displayName} moved ${successfullyMovedCards.length} card(s) from Game Board to ${destinationName}`
                if (successfullyMovedCards.length > 0 && movedCardsList.length < 500) {
                    publicMessage += `: ${movedCardsList}`
                }
                if (publicMessage.length > 2000) {
                    publicMessage = `${interaction.member.displayName} moved ${successfullyMovedCards.length} card(s) from Game Board to ${destinationName}. (Card list too long to display).`
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

module.exports = new GameBoardMove()