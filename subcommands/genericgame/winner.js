const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class NewGame {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        )

        if (gameData.isdeleted) {
            await interaction.reply({ content: `No active game in this channel`, ephemeral: true })
        } else {
            let players = [];

            for(let i=0; i<gameData.players.length; i++){
                let variable = `player${i+1}`
                if (interaction.options.getUser(variable) && find(gameData.players, {'userId': interaction.options.getUser(variable).id})){
                    players.push(interaction.options.getUser(variable).id);
                }
            }            
            console.log(players)
            if (players.length > 0) {
                gameData.winner = players
                //client.setGameData(`game-${interaction.channel.id}`, gameData)
                await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

                const winEmbed = await Formatter.GameWinner(gameData, interaction.guild)
                winEmbed.setFooter({text: `use /winshare to tell another channel about the win!`})

                await interaction.reply({ 
                    embeds: [winEmbed]
                })
            } else {
                await interaction.reply({ content: `I can't seem to find any of those players in this game...`, ephemeral: true })
            }

        }
    }
}


module.exports = new NewGame()