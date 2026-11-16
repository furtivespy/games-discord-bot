const GameHelper = require('../../modules/GlobalGameHelper')
const GameStatusHelper = require('../../modules/GameStatusHelper')
const CardMoves = require('../../modules/cardMoves')
const { ACTION_COUNT_MAX, ACTION_COUNT_MIN, parseActionCount } = require('../../modules/actionCount')

class Deal {
    async execute(interaction, client) {

        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
        } else {
            const [, gameData] = await Promise.all([
                interaction.deferReply(),
                GameHelper.getGameData(client, interaction)
            ])
            if (gameData.isdeleted) {
                await interaction.editReply({ content: `There is no game in this channel.`})
                return
            }

            const cardCount = parseActionCount(interaction.options.getInteger('count'))
            if (cardCount == null) {
                await interaction.editReply({
                    content: `Enter a whole number of cards from ${ACTION_COUNT_MIN} to ${ACTION_COUNT_MAX}.`,
                })
                return
            }

            const deckResult = GameHelper.resolveDeckOption(gameData, interaction.options.getString('deck'))
            if (await GameHelper.replyIfUnspecifiedDeck(interaction, deckResult)) {
                return
            }
            const deck = deckResult.deck
            const result = CardMoves.dealMultiple(gameData, {
                deck,
                count: cardCount,
                actor: {
                    id: interaction.user.id,
                    username: interaction.user.username,
                    displayName: interaction.member?.displayName || interaction.user.username,
                },
            })
            if (!result.ok) {
                await interaction.editReply({ content: result.content })
                return
            }

            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)           

            await GameStatusHelper.sendGameStatus(interaction, client, gameData,
              { content: result.content }
            );
        }
    }
}


module.exports = new Deal()
