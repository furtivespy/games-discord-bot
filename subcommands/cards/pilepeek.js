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

        await interaction.deferReply({ ephemeral: true })
        
        const gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const pileId = interaction.options.getString('pile')
        const pile = GameHelper.getGlobalPile(gameData, pileId)
        
        if (!pile) {
            await interaction.editReply({ content: `Pile not found!`, ephemeral: true })
            return
        }

        if (pile.cards.length === 0) {
            await interaction.editReply({ content: `${pile.name} is empty.`, ephemeral: true })
            return
        }

        let followup = await Formatter.multiCard(pile.cards, `All Cards in ${pile.name}`)

        await interaction.editReply({ 
            content: `Peeking at ${pile.name} (${pile.cards.length} cards)${pile.isSecret ? ' 🔒' : ''}`,
            ephemeral: true 
        })

        await interaction.followUp({ 
            embeds: [...followup[0]], 
            files: [...followup[1]], 
            ephemeral: true 
        })
    }
}

module.exports = new PilePeek()
