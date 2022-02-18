const GameDB = require('../../db/anygame.js')
const { cloneDeep } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Flip {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            client.getGameData(`game-${interaction.channel.id}`)
        )

        if (interaction.isAutocomplete()) {

            await interaction.respond([
                { name: "Fake Deck 1", value: "one" },
                { name: "Fake Deck 2", value: "two" }
            ])

        } else {

            await interaction.reply({ content: "Not Ready Yet!?!?!?", ephemeral: true })
            /*
            if (gameData.isdeleted) {
                //await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
            } else {
                
                
            }
            */
        }
    }
}


module.exports = new Flip()