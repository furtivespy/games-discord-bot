const Command = require('../../base/Command.js')
const Formatter = require('../../modules/GenericGameFormatter.js')
const CardDB = require('../../db/carddecks.js')
const Discord = require('discord.js')
const _ = require('lodash')

class GameName extends Command {
    constructor(client){
        super(client, {
            name: "game-name",
            description: "Change the name of the current in channel game",
            category: "Generic Game",
            usage: "use this command to change the game's name",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: false,
            aliases: ["gamename", "gname"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            if (args[0]) {
                let gameData = Object.assign({}, _.cloneDeep(CardDB.defaultGameData), this.client.getGameData(`cards-${message.channel.id}`))
                gameData.name = args.join(" ")
                this.client.setGameData(`cards-${message.channel.id}`, gameData)
                await message.channel.send({embeds: [await Formatter.GameStatus(gameData, message)]})
            } else {
                message.reply("Please incude the new name")
            }
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

}

module.exports = GameName