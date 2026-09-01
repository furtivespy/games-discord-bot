const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const Formatter = require('../../modules/GameFormatter')
const DeckRecipeHelper = require('../../modules/DeckRecipeHelper')

class DeckAddList {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
            return
        }

        const [, gameData] = await Promise.all([
            interaction.deferReply(),
            GameHelper.getGameData(client, interaction)
        ])

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.` })
            return
        }

        const inputDeck = interaction.options.getString('deck')
        const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)
        if (!deck) {
            await interaction.editReply({ content: `No Deck Found` })
            return
        }

        const customlist = interaction.options.getString('customlist')
        const names = DeckRecipeHelper.parseNameList(customlist)
        if (names.length < 1) {
            await interaction.editReply({ content: `No card names found in the list. Use comma-separated names, same as /cards deck new custom-csv.` })
            return
        }

        const added = DeckRecipeHelper.addCardsFromNameList(deck, customlist)

        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardNames = added.map(card => card.name).join(', ')

            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.ADD,
                `${actorDisplayName} added ${added.length} cards to ${deck.name}: ${cardNames}`,
                {
                    deckName: deck.name,
                    cardIds: added.map(card => card.id),
                    cardNames,
                    cardCount: added.length,
                    newDeckSize: deck.allCards.length,
                    action: "add list to in-game deck recipe"
                }
            )
        } catch (error) {
            console.warn('Failed to record deck addlist in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        await interaction.editReply({
            content: `${actorDisplayName} added ${added.length} card(s) to ${deck.name}: ${names.join(', ')}`,
            embeds: Formatter.deckStatus2(gameData)
        })
    }
}

module.exports = new DeckAddList()
