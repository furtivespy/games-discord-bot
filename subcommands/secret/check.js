const { MessageFlags } = require("discord.js");
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
            await interaction.reply({ content: `Your Secret Info:\n${myData.secret}`, flags: MessageFlags.Ephemeral })
        } else {
            await interaction.reply({ content: `You don't have any secrets yet.`, flags: MessageFlags.Ephemeral })
        }

    }
}


module.exports = new Check()