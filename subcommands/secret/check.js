const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')

class Check {
    async execute(interaction, client) {

        let secretData = Object.assign(
            {},
            cloneDeep(GameDB.defaultSecretData), 
            await client.getGameDataV2(interaction.guildId, 'secret', interaction.channelId)
        )
        
        let myData = find(secretData.players, {'userId': interaction.user.id})

        if (myData && myData.hassecret){
            await interaction.reply({ content: `Your Secret Info:\n${myData.secret}`, ephemeral: true })
        } else {
            await interaction.reply({ content: `You don't have any secrets yet.`, ephemeral: true })
        }

    }
}


module.exports = new Check()