const GameDB = require('../../db/anygame.js')
const { cloneDeep } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Test {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        )

        if (gameData.isdeleted) {
            await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
        } else {
            //const data = await Formatter.GameStatusV2(gameData, interaction.guild)
        
            //console.log(JSON.stringify(gameData.players))

            let local = await client.queryGameData(interaction.guildId, 'game', {bggGameId: 266830}) 
            console.log(local)

            await interaction.reply({
            content: `Please choose from the available options`,
            ephemeral: true
            })
            return 
            

        }
    }
}


module.exports = new Test()