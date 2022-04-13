const GameDB = require('../../db/anygame.js')
const { cloneDeep } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Status {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            client.getGameData(`game-${interaction.channel.id}`)
        )

        if (gameData.isdeleted) {
            await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
        } else {
            const data = await Formatter.GameStatusV2(gameData, interaction.guild)

            let deckEmbeds = []
            gameData.decks.forEach(deck => {
                deckEmbeds.push(Formatter.deckStatus(deck))
            })
            await interaction.reply({ 
                embeds: [
                    ...deckEmbeds
                ],
                files: [...data],
            })  
            

        }
    }
}


module.exports = new Status()