const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class NewGame {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            await client.getGameData(`game-${interaction.channel.id}`)
        )

        if (gameData.isdeleted) {
            await interaction.reply({ content: `No active game in this channel`, ephemeral: true })
        } else {
            let winUser = interaction.options.getUser('who')

            let exists = find(gameData.players, {'userId': winUser.id})

            if (exists) {
                gameData.winner = winUser.id
                client.setGameData(`game-${interaction.channel.id}`, gameData)

                const winEmbed = await Formatter.GameWinner(gameData, interaction.guild)
                winEmbed.setFooter({text: `use /winshare to tell another channel about the win!`})

                await interaction.reply({ 
                    embeds: [winEmbed]
                })
            } else {
                await interaction.reply({ content: `I can't seem to find that player in this game...`, ephemeral: true })
            }

        }
    }
}


module.exports = new NewGame()