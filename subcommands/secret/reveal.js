const GameDB = require('../../db/anygame.js')
const { cloneDeep } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Reveal {
    async execute(interaction, client) {

        if (interaction.options.getString('confirm') == 'reveal') {
            let secretData = Object.assign(
                {},
                cloneDeep(GameDB.defaultSecretData), 
                await client.getGameDataV2(interaction.guildId, 'secret', interaction.channelId)
            )
            
            if (secretData.players.length > 0){
                secretData.isrevealed = true
                //client.setGameData(`secret-${interaction.channel.id}`, secretData)
                await client.setGameDataV2(interaction.guildId, "secret", interaction.channelId, secretData)

                await interaction.reply({ 
                    content: `Your Secrets!`,
                    embeds: [await Formatter.SecretStatus(secretData, interaction.guild)]
                })
            } else {
                await interaction.reply({ content: `Nothing to reveal...`, ephemeral: true })
            }

        } else {
            await interaction.reply({ content: `Nothing revealed...`, ephemeral: true })
        }

    }
}


module.exports = new Reveal()