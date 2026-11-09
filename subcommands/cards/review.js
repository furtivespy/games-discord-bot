const { MessageFlags } = require("discord.js");
const GameHelper = require('../../modules/GlobalGameHelper')
const Formatter = require('../../modules/GameFormatter')

class Review {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
            return
        }

        const [, gameData] = await Promise.all([
            interaction.deferReply(),
            GameHelper.getGameData(client, interaction)
        ]);

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        const deckResult = GameHelper.resolveDeckOption(gameData, interaction.options.getString('deck'))
        if (await GameHelper.replyIfUnspecifiedDeck(interaction, deckResult)) {
            return
        }
        const deck = deckResult.deck
        if (!deck){
            await interaction.editReply({ content: `No deck found.`})
            return
        }

        const allCards = deck.allCards
        if (!Array.isArray(allCards) || allCards.length === 0) {
            await interaction.editReply({
                content: `The ${deck.name} deck has no cards.`
            })
            return
        }
        
        const [, followup] = await Promise.all([
            interaction.editReply({ 
                content: `${interaction.member.displayName} is reviewing the total makeup of ${deck.name}`}),
            Formatter.multiCard(allCards, `All cards in ${deck.name}`)
        ]);
        
        await Formatter.followUpCardDisplay(interaction, followup, { flags: MessageFlags.Ephemeral })
    }
}

module.exports = new Review()
