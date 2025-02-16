const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class RemovePlayer {
    async execute(interaction, client) {
        await interaction.deferReply()

        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ 
                content: `No active game in this channel`, 
                ephemeral: true 
            })
            return
        }

        const playerToRemove = interaction.options.getUser('player')
        
        // Find the player in the game
        const player = find(gameData.players, { userId: playerToRemove.id })
        if (!player) {
            await interaction.editReply({ 
                content: `${playerToRemove} is not in this game!`, 
                ephemeral: true 
            })
            return
        }

        // Discard all cards from player's hand
        if (player.hands.main.length > 0) {
            for (const card of player.hands.main) {
                const deck = find(gameData.decks, {name: card.origin})
                if (deck) {
                    deck.piles.discard.cards.push(card)
                }
            }
            player.hands.main = []
        }

        // Remove player and reorder remaining players
        const playerIndex = findIndex(gameData.players, { userId: playerToRemove.id })
        gameData.players.splice(playerIndex, 1)
        
        // Update order numbers for remaining players
        for (let i = 0; i < gameData.players.length; i++) {
            gameData.players[i].order = i
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        const data = await Formatter.GameStatusV2(gameData, interaction.guild)

        await interaction.editReply({ 
            content: `Removed ${playerToRemove} from the game and discarded their cards`,
            embeds: gameData.decks.length > 0 ? [...Formatter.deckStatus2(gameData)] : [],
            files: [...data]
        })
    }
}

module.exports = new RemovePlayer() 