const Command = require('../../base/Command.js')
const BazaarFormatter = require('../../modules/BazaarFormatter.js')

class Market extends Command {
    constructor(client){
        super(client, {
            name: "bazaar-market",
            description: "view the current market",
            category: "Bazaar",
            usage: "use this command to see the status of the current market",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["bazaar-viewmarket", "bazaar-bazaar", "bazaar-m"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var gameData = await this.client.getGameData(`bazaar-${message.channel.id}`)
            if (gameData.players === undefined || gameData.gameOver) {
                await message.channel.send(`No Game Happening in this Channel`)
            } else {
                await message.channel.send({embeds: [BazaarFormatter.bazaarEmbed(gameData)]})
            }
            
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }
}

module.exports = Market