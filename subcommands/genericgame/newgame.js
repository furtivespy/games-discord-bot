const GameDB = require('../../db/anygame.js')
const { cloneDeep, shuffle } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class NewGame {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            client.getGameData(`game-${interaction.channel.id}`)
        )

        if (!gameData.isdeleted) {
            await interaction.reply({ content: `There is an existing game in this channel. Delete it if you want to start a new one.`, ephemeral: true })
        } else {
            gameData = Object.assign(
                {},
                cloneDeep(GameDB.defaultGameData)
            )    
            let players = []

            if (interaction.options.getUser('player1')) players.push(interaction.options.getUser('player1'))
            if (interaction.options.getUser('player2')) players.push(interaction.options.getUser('player2'))
            if (interaction.options.getUser('player3')) players.push(interaction.options.getUser('player3'))
            if (interaction.options.getUser('player4')) players.push(interaction.options.getUser('player4'))
            if (interaction.options.getUser('player5')) players.push(interaction.options.getUser('player5'))
            if (interaction.options.getUser('player6')) players.push(interaction.options.getUser('player6'))

            let content = `New Game Created.\nPlayer Order Randomized!\n`
            gameData.isdeleted = false
            gameData.name = interaction.channel.name
            players = shuffle(players)
            for (let i = 0; i < players.length; i++) {
                gameData.players.push(
                    Object.assign(
                        {},
                        cloneDeep(GameDB.defaultPlayer), 
                        {
                            guildId: interaction.guild.id,
                            userId: players[i].id,
                            order: i,
                            name: players[i].username
                        }    
                    )
                )
                content += `${players[i]} `
            }

            client.setGameData(`game-${interaction.channel.id}`, gameData)
            

            await interaction.reply({ 
                content: content,
                embeds: [await Formatter.GameStatus(gameData, interaction.guild)]
            })
        }
    }
}


module.exports = new NewGame()