const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const _ = require('lodash')

class Rats extends Command {
    constructor(client){
        super(client, {
            name: "rats",
            description: "RATS game",
            category: "Rats",
            usage: "use this command to deal with RATS",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["rat"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            if (args[0]) {
                const newCmd = args.shift()
                this.client.TryExecuteCommand("rats-" + newCmd.toLowerCase(), message, args)
            } else {
                    this.client.TryExecuteCommand("rats-help", message, args)             
                
            }
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

}

module.exports = Rats