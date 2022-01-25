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
            
            await interaction.reply({ 
            embeds: [await Formatter.GameStatus(gameData, interaction.guild)]
            })
        }
    }
}


module.exports = new Status()