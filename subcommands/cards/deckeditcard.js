const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const Formatter = require('../../modules/GameFormatter')
const DeckRecipeHelper = require('../../modules/DeckRecipeHelper')

class DeckEditCard {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const gameData = await GameHelper.getGameData(client, interaction)
            const focusedOption = interaction.options.getFocused(true)

            if (focusedOption.name === 'deck') {
                await GameHelper.getDeckAutocomplete(gameData, interaction)
                return
            }

            if (focusedOption.name === 'card') {
                if (gameData.isdeleted) {
                    await interaction.respond([])
                    return
                }
                const inputDeck = interaction.options.getString('deck')
                const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)
                const cards = deck?.allCards
                    || (gameData.decks || []).flatMap((d) => d.allCards || [])
                await interaction.respond(
                    DeckRecipeHelper.getRecipeCardAutocomplete(focusedOption.value, cards)
                )
                return
            }

            await interaction.respond([])
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

        const cardId = (interaction.options.getString('card') || '').trim()
        if (!cardId) {
            await interaction.editReply({ content: DeckRecipeHelper.MISSING_CARD_MESSAGE })
            return
        }

        const normalized = DeckRecipeHelper.normalizeEditPatch(
            DeckRecipeHelper.collectEditPatch(interaction)
        )
        if (normalized.error) {
            await interaction.editReply({ content: normalized.error })
            return
        }

        const result = DeckRecipeHelper.editCardById(gameData, deck, cardId, normalized.patch)
        if (!result.ok) {
            await interaction.editReply({ content: result.error })
            return
        }

        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardName = Formatter.cardShortName(result.card)
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.MODIFY,
                `${actorDisplayName} edited ${cardName} in ${deck.name}`,
                {
                    deckName: deck.name,
                    cardId: result.card.id,
                    cardName,
                    changes: normalized.patch,
                    action: "edit card in in-game deck recipe"
                }
            )
        } catch (error) {
            console.warn('Failed to record deck editcard in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        await DeckRecipeHelper.editReplyAfterSave(interaction, {
            content: DeckRecipeHelper.formatEditCardContent(
                actorDisplayName,
                deck.name,
                result.card,
                normalized.patch
            ),
            embeds: DeckRecipeHelper.buildAddCardEmbeds(gameData, result.card),
        })
    }
}

module.exports = new DeckEditCard()
