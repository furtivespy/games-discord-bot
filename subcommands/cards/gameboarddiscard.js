const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find, findIndex, sortBy, filter } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')

class GameBoardDiscard {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true)
            const gameData = await GameHelper.getGameData(client, interaction)
            
            if (focusedOption.name === 'card') {
                if (!gameData.gameBoard || gameData.gameBoard.length === 0) {
                    await interaction.respond([])
                    return
                }
                await interaction.respond(
                    sortBy(
                        filter(gameData.gameBoard, 
                            crd => Formatter.cardShortName(crd).toLowerCase()
                                .includes(focusedOption.value.toLowerCase())
                        ), ['suit', 'value', 'name']).map(crd => 
                        ({name: Formatter.cardShortName(crd), value: crd.id}))
                )
            } else if (focusedOption.name === 'pilename') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedOption.value))
            }
            return
        }

        await interaction.deferReply()
        
        const gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const cardId = interaction.options.getString('card')
        const destination = interaction.options.getString('destination') || 'discard'
        const pileId = interaction.options.getString('pilename')

        if (!gameData.gameBoard || gameData.gameBoard.length < 1) {
            await interaction.editReply({ content: `No cards on the Game Board!`, ephemeral: true })
            return
        }

        const cardIndex = findIndex(gameData.gameBoard, {id: cardId})
        if (cardIndex === -1) {
            await interaction.editReply({ content: "Card not found on game board!", ephemeral: true })
            return
        }

        const [discardedCard] = gameData.gameBoard.splice(cardIndex, 1)
        let destinationName = ''

        // Handle different destinations
        if (destination === 'pile') {
            const pile = GameHelper.getGlobalPile(gameData, pileId)
            if (!pile) {
                // Return card to board if pile not found
                gameData.gameBoard.splice(cardIndex, 0, discardedCard)
                await interaction.editReply({ content: 'Pile not found!', ephemeral: true })
                return
            }
            pile.cards.push(discardedCard)
            destinationName = pile.name
        } else {
            // Default to origin deck's discard pile
            let deck = find(gameData.decks, {name: discardedCard.origin})
            if (deck && deck.piles && deck.piles.discard) {
                deck.piles.discard.cards.push(discardedCard)
                destinationName = `${deck.name} discard pile`
            } else {
                // Return card to board if deck not found
                gameData.gameBoard.splice(cardIndex, 0, discardedCard)
                await interaction.editReply({ content: "Could not find deck's discard pile!", ephemeral: true })
                return
            }
        }

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardName = Formatter.cardShortName(discardedCard)
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.DISCARD,
                `${actorDisplayName} discarded ${cardName} from Game Board to ${destinationName}`,
                {
                    source: 'gameboard',
                    cardId: discardedCard.id,
                    cardName: cardName,
                    destination: destinationName,
                    destinationType: destination
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record game board discard in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
            content: `${interaction.member.displayName} discarded ${Formatter.cardShortName(discardedCard)} from Game Board to ${destinationName}`,
            additionalEmbeds: [Formatter.oneCard(discardedCard)]
        })
    }
}

module.exports = new GameBoardDiscard()
