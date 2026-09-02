const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const Formatter = require('../../modules/GameFormatter')
const DeckRecipeHelper = require('../../modules/DeckRecipeHelper')

class DeckAddCard {
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

        const name = (interaction.options.getString('name') || '').trim()
        if (!name) {
            await interaction.editReply({ content: `A card name is required.` })
            return
        }

        const copies = interaction.options.getInteger('copies') ?? 1
        const format = interaction.options.getString('format') || 'A'
        const url = (interaction.options.getString('url') || '').trim() || null
        if (url && !DeckRecipeHelper.isEmbedImageUrl(url)) {
            await interaction.editReply({ content: `Card image URL must be a valid http or https URL.` })
            return
        }

        const added = DeckRecipeHelper.addRichCards(deck, {
            name,
            url,
            type: interaction.options.getString('type'),
            suit: interaction.options.getString('suit'),
            value: interaction.options.getString('value'),
            description: interaction.options.getString('description'),
            format,
        }, copies)

        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardName = Formatter.cardShortName(added[0])
            const copyLabel = added.length === 1 ? cardName : `${added.length} copies of ${cardName}`

            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.ADD,
                `${actorDisplayName} added ${copyLabel} to ${deck.name}`,
                {
                    deckName: deck.name,
                    cardIds: added.map(card => card.id),
                    cardName,
                    copies: added.length,
                    format,
                    newDeckSize: deck.allCards.length,
                    action: "add card to in-game deck recipe"
                }
            )
        } catch (error) {
            console.warn('Failed to record deck addcard in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        await interaction.editReply({
            content: `${actorDisplayName} added ${added.length} card(s) "${name}" to ${deck.name}`,
            embeds: [
                Formatter.oneCard(added[0]),
                ...Formatter.deckStatus2(gameData)
            ]
        })
    }
}

module.exports = new DeckAddCard()
