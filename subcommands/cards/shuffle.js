const GameDB = require('../../db/anygame.js')
const { cloneDeep } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Shuffle {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            client.getGameData(`game-${interaction.channel.id}`)
        )

        if (interaction.isAutocomplete()) {
            if (gameData.isdeleted || gameData.decks.length < 1){
                await interaction.respond([])
                return
            }
            await interaction.respond(gameData.decks.map(d => ({name: d.name, value: d.name})))
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


module.exports = new Shuffle()