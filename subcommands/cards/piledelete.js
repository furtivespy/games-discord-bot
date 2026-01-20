const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class PileDelete {
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
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const pileId = interaction.options.getString('pile')
        const confirmation = interaction.options.getString('confirm')

        const pile = GameHelper.getGlobalPile(gameData, pileId)
        if (!pile) {
            await interaction.editReply({ content: `Pile not found!`, ephemeral: true })
            return
        }

        // Require confirmation
        if (confirmation !== 'delete') {
            await interaction.editReply({ 
                content: `To delete the pile "${pile.name}", you must type "delete" in the confirm field.`, 
                ephemeral: true 
            })
            return
        }

        const cardCount = pile.cards.length

        // Delete the pile
        GameHelper.deleteGlobalPile(gameData, pileId)

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.GAME,
                GameDB.ACTION_TYPES.DELETE,
                `${actorDisplayName} deleted pile "${pile.name}" (had ${cardCount} cards)`,
                {
                    pileId: pile.id,
                    pileName: pile.name,
                    cardCount: cardCount
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record pile deletion in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
            content: `${interaction.member.displayName} deleted pile: **${pile.name}** (had ${cardCount} cards)`
        })
    }
}

module.exports = new PileDelete()
