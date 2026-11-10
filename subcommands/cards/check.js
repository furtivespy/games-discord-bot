const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const Formatter = require('../../modules/GameFormatter')

class Check {
    async execute(interaction, client) {

        
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
        } else {
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

            const discardCards = deck.piles?.discard?.cards
            if (!Array.isArray(discardCards) || discardCards.length === 0) {
                await interaction.editReply({
                    content: `The ${deck.name} discard pile is empty.`
                })
                return
            }

            const [, followup] = await Promise.all([
                interaction.editReply({ 
                    content: `${interaction.member.displayName} is looking at the ${deck.name} discard pile`
                }),
                Formatter.multiCard(discardCards, `All Discards in ${deck.name}`)
            ]);

            await Formatter.followUpCardDisplay(interaction, followup, { flags: MessageFlags.Ephemeral })
        }
    }
}

module.exports = new Check()
