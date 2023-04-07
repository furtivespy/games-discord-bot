const Command = require('../../base/Command.js')
const Formatter = require('../../modules/GenericGameFormatter.js')
const Discord = require('discord.js')
const _ = require('lodash')

class Game extends Command {
    constructor(client){
        super(client, {
            name: "game",
            description: "Channel Game Status",
            category: "Generic Game",
            usage: "use this command to get the channel's Game status",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["game", "g"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            if (args[0]) {
                const newCmd = args.shift()
                this.client.TryExecuteCommand("game-" + newCmd.toLowerCase(), message, args)
            } else {
                let gameData = await this.client.getGameData(`cards-${message.channel.id}`)
                if ((gameData.decks && gameData.decks.length > 0) || (gameData.players && gameData.players.length > 0)) {
                    
                    await message.channel.send({embeds: [await Formatter.GameStatus(gameData, message)]})

                } else {
                    this.client.TryExecuteCommand("game-help", message, args)
                }                
                
            }
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

}

module.exports = Game