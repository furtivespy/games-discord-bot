const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find, findIndex, sortBy, filter } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')

class GameBoardTake {
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

        await interaction.deferReply({ ephemeral: true })
        
        const gameData = await GameHelper.getGameData(client, interaction)
        
        const cardId = interaction.options.getString('card')
        const destination = interaction.options.getString('destination') || 'hand'
        const pileId = interaction.options.getString('pilename')
        
        const player = find(gameData.players, {userId: interaction.user.id})
        
        if (!player) {
            await interaction.editReply({ content: "You must be a player in this game!", ephemeral: true })
            return
        }

        if (!gameData.gameBoard || gameData.gameBoard.length < 1) {
            await interaction.editReply({ content: `No cards on the Game Board!`, ephemeral: true })
            return
        }

        const cardIndex = findIndex(gameData.gameBoard, {id: cardId})
        if (cardIndex === -1) {
            await interaction.editReply({ content: "Card not found on game board!", ephemeral: true })
            return
        }

        const [takenCard] = gameData.gameBoard.splice(cardIndex, 1)
        let destinationName = ''

        // Handle different destinations
        if (destination === 'pile') {
            const pile = GameHelper.getGlobalPile(gameData, pileId)
            if (!pile) {
                // Return card to board if pile not found
                gameData.gameBoard.splice(cardIndex, 0, takenCard)
                await interaction.editReply({ content: 'Pile not found!', ephemeral: true })
                return
            }
            pile.cards.push(takenCard)
            destinationName = pile.name
        } else if (destination === 'playarea') {
            if (!player.playArea) {
                player.playArea = []
            }
            player.playArea.push(takenCard)
            destinationName = 'your play area'
        } else {
            // Default to hand
            player.hands.main.push(takenCard)
            destinationName = 'your hand'
        }

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardName = Formatter.cardShortName(takenCard)
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.TAKE,
                `${actorDisplayName} took ${cardName} from Game Board to ${destinationName}`,
                {
                    source: 'gameboard',
                    cardId: takenCard.id,
                    cardName: cardName,
                    destination: destinationName,
                    destinationType: destination
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record game board take in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await interaction.editReply({ 
            content: `You took ${Formatter.cardShortName(takenCard)} from Game Board to ${destinationName}`,
            ephemeral: true
        })

        // Show updated hand if destination was hand
        if (destination === 'hand') {
            const handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
            const privateFollowup = { embeds: [...handInfo.embeds], ephemeral: true }
            if (handInfo.attachments.length > 0) {
                privateFollowup.files = [...handInfo.attachments]
            }
            await interaction.followUp(privateFollowup)
        }
    }
}

module.exports = new GameBoardTake()
