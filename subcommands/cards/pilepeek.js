const { MessageFlags } = require("discord.js");
const GameHelper = require('../../modules/GlobalGameHelper')
const Formatter = require('../../modules/GameFormatter')

class PilePeek {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const gameData = await GameHelper.getGameData(client, interaction)
            const focusedValue = interaction.options.getString('pile')
            await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedValue))
            return
        }

        const [, gameData] = await Promise.all([
            interaction.deferReply({ flags: MessageFlags.Ephemeral }),
            GameHelper.getGameData(client, interaction)
        ]);

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        const pileId = interaction.options.getString('pile')
        const pile = GameHelper.getGlobalPile(gameData, pileId)
        
        if (!pile) {
            await interaction.editReply({ content: `Pile not found!`})
            return
        }

        if (pile.cards.length === 0) {
            await interaction.editReply({ content: `${pile.name} is empty.`})
            return
        }

        const [, followup] = await Promise.all([
            interaction.editReply({ 
                content: `Peeking at ${pile.name} (${pile.cards.length} cards)${pile.isSecret ? ' 🔒' : ''}`}),
            Formatter.multiCard(pile.cards, `All Cards in ${pile.name}`)
        ]);

        await interaction.followUp({ 
            embeds: [...followup[0]], 
            files: [...followup[1]], 
            flags: MessageFlags.Ephemeral 
        })
    }
}

module.exports = new PilePeek()
