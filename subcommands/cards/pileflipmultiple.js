const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const Formatter = require('../../modules/GameFormatter')

class PileFlipMultiple {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const gameData = await GameHelper.getGameData(client, interaction)
            const focusedValue = interaction.options.getFocused(true)
            if (focusedValue.name === 'pile') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedValue.value))
            } else if (focusedValue.name === 'destinationpile') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedValue.value))
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
        const count = interaction.options.getInteger('count')
        const destination = interaction.options.getString('destination') || 'gameboard'
        const destinationPileId = interaction.options.getString('destinationpile')
        const pile = GameHelper.getGlobalPile(gameData, pileId)

        if (!pile) {
            await interaction.editReply({ content: `Pile not found!`, ephemeral: true })
            return
        }

        if (pile.cards.length < 1) {
            await interaction.editReply({ content: `No cards in ${pile.name}!`, ephemeral: true })
            return
        }

        if (pile.cards.length < count) {
            await interaction.editReply({
                content: `Not enough cards in ${pile.name}! (has ${pile.cards.length}, requested ${count})`,
                ephemeral: true
            })
            return
        }

        const flippedCards = pile.cards.splice(0, count)
        let destinationName = ''

        if (destination === 'gameboard') {
            if (!gameData.gameBoard) {
                gameData.gameBoard = []
            }
            gameData.gameBoard.push(...flippedCards)
            destinationName = 'Game Board'
        } else if (destination === 'pile') {
            const destPile = GameHelper.getGlobalPile(gameData, destinationPileId)
            if (!destPile) {
                pile.cards.unshift(...flippedCards)
                await interaction.editReply({ content: 'Destination pile not found!', ephemeral: true })
                return
            }
            destPile.cards.push(...flippedCards)
            destinationName = destPile.name
        } else {
            // discard — find the first available deck's discard pile
            const deck = gameData.decks?.[0]
            if (!deck) {
                pile.cards.unshift(...flippedCards)
                await interaction.editReply({ content: 'No deck found to discard to. Use Game Board or a Custom Pile as destination.', ephemeral: true })
                return
            }
            deck.piles.discard.cards.push(...flippedCards)
            destinationName = `${deck.name} discard pile`
        }

        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardNames = flippedCards.map(c => Formatter.cardShortName(c)).join(', ')

            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.FLIP,
                `${actorDisplayName} flipped ${count} cards from ${pile.name} to ${destinationName}: ${cardNames}`,
                {
                    pileId: pile.id,
                    pileName: pile.name,
                    cardCount: count,
                    cardIds: flippedCards.map(c => c.id),
                    cardNames: cardNames,
                    destination: destinationName,
                    destinationType: destination
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record pile flip multiple in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const cardDisplay = await Formatter.multiCard(flippedCards, `Flipped from ${pile.name}`)

        await interaction.editReply({
            content: `${interaction.member.displayName} flipped ${count} card(s) from ${pile.name} to ${destinationName}:`,
            embeds: [...cardDisplay[0]],
            files: [...cardDisplay[1]]
        })
    }
}

module.exports = new PileFlipMultiple()
