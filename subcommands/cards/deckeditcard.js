const { MessageFlags } = require('discord.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const DeckRecipeHelper = require('../../modules/DeckRecipeHelper')
const DeckEditCardModal = require('../../modules/DeckEditCardModal')

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
                if (!deck) {
                    await interaction.respond([])
                    return
                }
                await interaction.respond(
                    DeckRecipeHelper.getRecipeCardAutocomplete(focusedOption.value, deck.allCards || [])
                )
                return
            }

            await interaction.respond([])
            return
        }

        const gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.reply({
                content: `There is no game in this channel.`,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const inputDeck = interaction.options.getString('deck')
        const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)
        if (!deck) {
            await interaction.reply({
                content: `No Deck Found`,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const cardId = (interaction.options.getString('card') || '').trim()
        const card = DeckRecipeHelper.findRecipeCard(deck, cardId)
        if (!card) {
            await interaction.reply({
                content: DeckRecipeHelper.MISSING_CARD_MESSAGE,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        await DeckEditCardModal.openEditor(interaction, { deck, card })
    }
}

module.exports = new DeckEditCard()
