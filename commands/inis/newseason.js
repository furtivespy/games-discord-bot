const Command = require('../../base/Command.js')
const _ = require('lodash')
const InisFormatter = require('../../modules/InisFormatter.js')


class NewSeason extends Command {
    constructor(client){
        super(client, {
            name: "newseason",
            description: "Start New Season",
            category: "Inis",
            usage: "use this command to start new season and DM the first set of cards to pass",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["startseason"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var gameData = this.client.getGameData("INIS")
            gameData.greenDeck = _.shuffle([...gameData.greenDeck])

            gameData.players.forEach((p, ix) => {
                p.hand = p.hand.filter(c => c.type != "season")
                p.hand.push(...gameData.greenDeck.slice(ix*4, (ix*4) + 4 ))
            })

            if (_.random(0,1) != gameData.isClockwise){
                gameData.isClockwise = !gameData.isClockwise
                gameData.order = (gameData.isClockwise) ? "Clockwise" : "Counterclockwise"
                await message.channel.send(`The Crows have reversed direction to ${gameData.order} :bird:`)
            } else {
                await message.channel.send(`Crows continue to flock ${gameData.order} :bird:`)
            }

            await message.channel.send(await InisFormatter.gameStatus(this.client, gameData))
            var msg = await message.channel.send(`DMing players the Cards...`)
            var guild = await this.client.guilds.fetch(gameData.players[0].guildId)

            await Promise.all(gameData.players.map(async player => {
                var user = await guild.members.fetch(player.userId)
                player.hand.filter(c => c.type == "season").forEach(card => {
                    user.send(InisFormatter.createCardEmbed(card, `Round 1`))
                })
            }))
            
            this.client.setGameData("INIS", gameData)
            await msg.edit(`Cards Sent!`)

        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = NewSeason