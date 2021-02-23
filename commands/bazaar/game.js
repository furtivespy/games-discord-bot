const Command = require('../../base/Command.js')
const BazaarFormatter = require('../../modules/BazaarFormatter.js')

class Game extends Command {
    constructor(client){
        super(client, {
            name: "bazaar-game",
            description: "view the current game",
            category: "Bazaar",
            usage: "use this command to see the status of the current game",
            enabled: true,
            guildOnly: false,
            allMessages: false,
            showHelp: true,
            aliases: ["bazaar-viewgame"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var gameData = this.client.getGameData(`bazaar-${message.channel.id}`)
            if (gameData.players === undefined) {
                await message.channel.send(`No Game Happening in this Channel`)
            } else {
                await message.channel.send(await BazaarFormatter.gameStatus(this.client, gameData))
            }
            
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Game