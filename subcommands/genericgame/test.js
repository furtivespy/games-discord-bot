const GameDB = require('../../db/anygame.js')
const { cloneDeep } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Test {
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

        
            console.log(JSON.stringify(gameData.players))

            await interaction.reply({ 
                embeds: [
                    ...Formatter.deckStatus2(gameData)
                ],
                files: [...data],
            })  
            

        }
    }
}


module.exports = new Test()