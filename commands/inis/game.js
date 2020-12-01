const Command = require('../../base/Command.js')
const InisFormatter = require('../../modules/InisFormatter.js')

class Game extends Command {
    constructor(client){
        super(client, {
            name: "game",
            description: "view the current game",
            category: "Inis",
            usage: "use this command to see the status of the current game",
            enabled: true,
            guildOnly: false,
            allMessages: false,
            showHelp: true,
            aliases: ["viewgame"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var gameData = this.client.getGameData("INIS")
            await message.channel.send(await InisFormatter.gameStatus(this.client, gameData))

        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Game