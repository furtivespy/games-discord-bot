const Command = require('../../base/Command.js')
const _ = require('lodash')
const InisFormatter = require('../../modules/InisFormatter.js')


class Crows extends Command {
    constructor(client){
        super(client, {
            name: "inis-crows",
            description: "Flip the flock of crows token",
            category: "Inis",
            usage: "use this command to flip the flock of crows",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["inis-flipcrows","inis-flock"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var gameData = await this.client.getGameData("INIS")
            gameData.isClockwise = !gameData.isClockwise
            gameData.order = (gameData.isClockwise) ? "Clockwise" : "Counterclockwise"
            this.client.setGameData("INIS", gameData)
            await message.channel.send({embeds: [await InisFormatter.gameStatus(this.client, gameData)]})
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Crows