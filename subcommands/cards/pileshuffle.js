const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { shuffle } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class PileShuffle {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const gameData = await GameHelper.getGameData(client, interaction)
            const focusedValue = interaction.options.getString('pile')
            await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedValue))
            return
        }

        await interaction.deferReply()
        
        const gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        const pileId = interaction.options.getString('pile')
        const pile = GameHelper.getGlobalPile(gameData, pileId)
        
        if (!pile) {
            await interaction.editReply({ content: `Pile not found!`})
            return
        }

        if (pile.cards.length === 0) {
            await interaction.editReply({ content: `${pile.name} is empty, nothing to shuffle.`})
            return
        }

        // Shuffle the pile
        pile.cards = shuffle(pile.cards)

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.SHUFFLE,
                `${actorDisplayName} shuffled ${pile.name}`,
                {
                    pileId: pile.id,
                    pileName: pile.name,
                    cardCount: pile.cards.length
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record pile shuffle in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
            content: `${interaction.member.displayName} shuffled **${pile.name}** (${pile.cards.length} cards)`
        })
    }
}

module.exports = new PileShuffle()
