const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const _ = require('lodash')

class Deal extends Command {
    constructor(client){
        super(client, {
            name: "cards-deal",
            description: "Card Game Dealer",
            category: "Cards",
            usage: "Soon I will deal cards!",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["card-deal", "cdeal"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            if (args[0]) {

            } else {
                
            }
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

}

module.exports = Deal