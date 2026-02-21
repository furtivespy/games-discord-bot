const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const Formatter = require('../../modules/GameFormatter')

class FlipMulti {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true)
            let gameData = await GameHelper.getGameData(client, interaction)

            if (focusedOption.name === 'deck') {
                await GameHelper.getDeckAutocomplete(gameData, interaction)
            } else if (focusedOption.name === 'pilename') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedOption.value))
            }
            return
        }

        await interaction.deferReply()

        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const inputDeck = interaction.options.getString('deck')
        const count = interaction.options.getInteger('count')
        const destination = interaction.options.getString('destination') || 'discard'
        const pileId = interaction.options.getString('pilename')

        const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)

        if (!deck || deck.piles.draw.cards.length < 1) {
            await interaction.editReply({ content: "No cards in draw pile", ephemeral: true })
            return
        }

        if (deck.piles.draw.cards.length < count) {
            await interaction.editReply({
                content: `Not enough cards in draw pile! (has ${deck.piles.draw.cards.length}, requested ${count})`,
                ephemeral: true
            })
            return
        }

        const flippedCards = deck.piles.draw.cards.splice(0, count)
        let destinationName = ''

        if (destination === 'pile') {
            const pile = GameHelper.getGlobalPile(gameData, pileId)
            if (!pile) {
                deck.piles.draw.cards.unshift(...flippedCards)
                await interaction.editReply({ content: 'Pile not found!', ephemeral: true })
                return
            }
            pile.cards.push(...flippedCards)
            destinationName = pile.name
        } else if (destination === 'gameboard') {
            if (!gameData.gameBoard) {
                gameData.gameBoard = []
            }
            gameData.gameBoard.push(...flippedCards)
            destinationName = 'Game Board'
        } else {
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
                `${actorDisplayName} flipped ${count} cards from ${deck.name} to ${destinationName}: ${cardNames}`,
                {
                    cardCount: count,
                    cardIds: flippedCards.map(c => c.id),
                    cardNames: cardNames,
                    deckName: deck.name,
                    source: "draw pile",
                    destination: destinationName,
                    destinationType: destination
                }
            )
        } catch (error) {
            console.warn('Failed to record card flip multiple in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const cardDisplay = await Formatter.multiCard(flippedCards, `Flipped from ${deck.name}`)

        await interaction.editReply({
            content: `Flipped ${count} card(s) from ${deck.name} to ${destinationName}`,
            embeds: [...cardDisplay[0]],
            files: [...cardDisplay[1]]
        })
    }
}

module.exports = new FlipMulti()
