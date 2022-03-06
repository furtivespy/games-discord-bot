const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Show {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            client.getGameData(`game-${interaction.channel.id}`)
        )

        if (gameData.isdeleted) {
            await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player){
            await interaction.reply({ content: "I don't think you're playing this game...", ephemeral: true })
            return
        }

        await interaction.reply({ 
            embeds: [
                Formatter.playerSecretHand(gameData, player)
            ],
            ephemeral: true
        })   
    }
}


module.exports = new Show()