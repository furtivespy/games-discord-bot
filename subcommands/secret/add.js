const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Add {
    async execute(interaction, client) {

        let secretData = Object.assign(
            {},
            cloneDeep(GameDB.defaultSecretData), 
            client.getGameData(`secret-${interaction.channel.id}`)
        )

        if (secretData.isrevealed) { //All New Secrets
            secretData = Object.assign(
                {},
                cloneDeep(GameDB.defaultSecretData),
                {isrevealed: false}
            )

            let gameData = Object.assign(
                {},
                cloneDeep(GameDB.defaultGameData), 
                client.getGameData(`game-${interaction.channel.id}`)
            )

            if (gameData.players.length > 0 && !gameData.isdeleted) {
                for (let i = 0; i < gameData.players.length; i++) {
                    secretData.players.push(Object.assign(
                        {},
                        cloneDeep(gameData.players[i]),
                        {hassecret: false, secret: "--", hands: []}
                    ))
                }
            }
        }

        let mySecret = find(secretData.players, {'userId': interaction.user.id})

        if (!mySecret) {
            secretData.players.push(Object.assign(
                {},
                cloneDeep(GameDB.defaultPlayer),
                {
                    guildId: interaction.guild.id,
                    userId: interaction.user.id,
                    name: interaction.username,
                } 
            ))

            mySecret = find(secretData.players, {'userId': interaction.user.id})
        }

        mySecret.hassecret = true
        mySecret.secret = interaction.options.getString('secret')
        client.setGameData(`secret-${interaction.channel.id}`, secretData)


        await interaction.reply({ 
            content: `Your secret is safe with me!`,
            embeds: [await Formatter.SecretStatus(secretData, interaction.guild)]
        })
        
    }
}


module.exports = new Add()