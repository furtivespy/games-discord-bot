const Command = require('../../base/Command.js')
const Formatter = require('../../modules/GenericGameFormatter.js')
const CardDB = require('../../db/carddecks.js')
const Discord = require('discord.js')
const _ = require('lodash')

class AddPlayer extends Command {
    constructor(client){
        super(client, {
            name: "game-addplayer",
            description: "Change the name of the current in channel game",
            category: "Generic Game",
            usage: "use this command to change the game's name",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: false,
            aliases: ["gameaddplayer", "gaddplayer", "g-addp", "gaddp", "game-addp"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            if (args[0]) {
                let gameData = Object.assign({}, _.cloneDeep(CardDB.defaultGameData), await this.client.getGameData(`cards-${message.channel.id}`))
                
                const newUser = this.getUserFromMention(args[0])
                let player = _.find(gameData.players, {userId: newUser.id})
                if (newUser && !player) {

                    player = Object.assign({}, _.cloneDeep(CardDB.defaultPlayer), {
                        userId: newUser.id, 
                        guildId: message.guild.id, 
                        name: newUser.username,
                        order: gameData.players.length + 1})
                    gameData.players.push(player)
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                }

                await message.channel.send({embeds: [await Formatter.GameStatus(gameData, message)]})

            } else {
                message.reply("Please incude a player to add")
            }
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

    getUserFromMention(mention) {
        if (!mention) return;
        const matches = mention.match(/^<@!?(\d+)>$/);
        if (!matches) return;
        const id = matches[1];
        return this.client.users.cache.get(id);
    }
}

module.exports = AddPlayer