const GameDB = require('../../db/anygame.js')
const { cloneDeep } = require('lodash')

class Delete {
    async execute(interaction, client) {

        if (interaction.options.getString('confirm') == 'delete') {
            let gameData = Object.assign(
                {},
                cloneDeep(GameDB.defaultGameData), 
                client.getGameData(`game-${interaction.channel.id}`)
            )
            
            if (!gameData.isdeleted){
                gameData.isdeleted = true
                client.setGameData(`game-${interaction.channel.id}`, gameData)
                await interaction.reply({ content: `Game Deleted!?` })
            } else {
                await interaction.reply({ content: `No Active Game to Delete...`, ephemeral: true })
            }

        } else {
            await interaction.reply({ content: `Nothing Deleted...`, ephemeral: true })
        }

        
    }
}


module.exports = new Delete()