const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const Formatter = require('../../modules/GameFormatter')

class PileFlip {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const gameData = await GameHelper.getGameData(client, interaction)
            const focusedValue = interaction.options.getFocused(true)
            if (focusedValue.name === 'pile') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedValue.value))
            } else if (focusedValue.name === 'destination') {
                await interaction.respond(GameHelper.getDestinationAutocomplete(gameData, focusedValue.value, ['gameboard', 'discard', 'pile']))
            }
            return
        }

        await interaction.deferReply()
        
        const gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const pileId = interaction.options.getString('pile')
        const destination = interaction.options.getString('destination') || 'gameboard'
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
        let destinationName = ''

        if (destination === 'gameboard') {
            if (!gameData.gameBoard) {
                gameData.gameBoard = []
            }
            gameData.gameBoard.push(flippedCard)
            destinationName = 'Game Board'
        } else if (destination === 'discard') {
            // discard — find the first available deck's discard pile
            // Ideally should find deck by card origin
            let deck = null;
            if (flippedCard.origin) {
                deck = gameData.decks.find(d => d.name === flippedCard.origin);
            }

            if (!deck) {
                deck = gameData.decks?.[0]
            }

            if (!deck) {
                pile.cards.unshift(flippedCard)
                await interaction.editReply({ content: 'No deck found to discard to. Use Game Board or a Custom Pile as destination.', ephemeral: true })
                return
            }
            deck.piles.discard.cards.push(flippedCard)
            destinationName = `${deck.name} discard pile`
        } else {
            // Assume pile
            const destPile = GameHelper.getGlobalPile(gameData, destination)
            if (!destPile) {
                pile.cards.unshift(flippedCard)
                await interaction.editReply({ content: 'Destination pile not found!', ephemeral: true })
                return
            }
            destPile.cards.push(flippedCard)
            destinationName = destPile.name
        }

        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardName = Formatter.cardShortName(flippedCard)
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.FLIP,
                `${actorDisplayName} flipped ${cardName} from ${pile.name} to ${destinationName}`,
                {
                    pileId: pile.id,
                    pileName: pile.name,
                    cardId: flippedCard.id,
                    cardName: cardName,
                    destination: destinationName,
                    destinationType: destination
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record pile flip in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await interaction.editReply({
            content: `${interaction.member.displayName} flipped from ${pile.name} to ${destinationName}:`,
            embeds: [Formatter.oneCard(flippedCard)]
        })
    }
}

module.exports = new PileFlip()