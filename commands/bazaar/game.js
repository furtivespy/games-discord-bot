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
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["bazaar-viewgame","bazaar-g"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var gameData = this.client.getGameData(`bazaar-${message.channel.id}`)
            if (gameData.players === undefined) {
                await message.channel.send(`No Game Happening in this Channel`)
            } else if (gameData.gameOver) {
                await message.channel.send(await BazaarFormatter.gameOver(this.client, gameData))
            } else {
                await message.channel.send(await BazaarFormatter.gameStatus(this.client, gameData))
                if (args.length > 0){
                    const guild = await this.client.guilds.fetch(gameData.players[0].guildId)
                    const currentPlayer = await guild.members.fetch(gameData.players.find(p => p.order == gameData.turn).userId)
                    await message.channel.send(`${currentPlayer} it is your turn`)
                }
            }
            
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Game