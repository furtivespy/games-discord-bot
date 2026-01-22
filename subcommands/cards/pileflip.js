const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class PileFlip {
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
        const pile = GameHelper.getGlobalPile(gameData, pileId)
        
        if (!pile) {
            await interaction.editReply({ content: `Pile not found!`, ephemeral: true })
            return
        }

        if (pile.cards.length < 1) {
            await interaction.editReply({ content: `No cards in ${pile.name}!`, ephemeral: true })
            return
        }

        const flippedCard = pile.cards.shift()

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardName = Formatter.cardShortName(flippedCard)
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.FLIP,
                `${actorDisplayName} flipped ${cardName} from ${pile.name}`,
                {
                    pileId: pile.id,
                    pileName: pile.name,
                    cardId: flippedCard.id,
                    cardName: cardName
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record pile flip in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
            content: `${interaction.member.displayName} flipped from ${pile.name}:`,
            additionalEmbeds: [Formatter.oneCard(flippedCard)]
        })
    }
}

module.exports = new PileFlip()
