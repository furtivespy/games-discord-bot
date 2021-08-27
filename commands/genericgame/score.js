const Command = require('../../base/Command.js')
const Formatter = require('../../modules/GenericGameFormatter.js')
const CardDB = require('../../db/carddecks.js')
const Discord = require('discord.js')
const _ = require('lodash')

class GameScore extends Command {
    constructor(client){
        super(client, {
            name: "game-score",
            description: "Change the name of the current in channel game",
            category: "Generic Game",
            usage: "use this command to change the game's name",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: false,
            aliases: ["gamescore", "gscore", "gamescoreboard", "game-scoreboard"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            let gameData = Object.assign({}, _.cloneDeep(CardDB.defaultGameData), this.client.getGameData(`cards-${message.channel.id}`))

            if (args[0]) {
                const scoreUser = this.getUserFromMention(args[0])
                if (scoreUser)
                {
                    let player = _.find(gameData.players, {userId: scoreUser.id})
                    if (!player) {
                        player = Object.assign({}, _.cloneDeep(CardDB.defaultPlayer))
                    }   
                    args.shift()

                    player.score = args.join(" ")
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                } else {
                    await message.react("❓")
                }
                await message.channel.send(await Formatter.GameStatus(gameData, message))
                
            } else {
                await message.channel.send(await Formatter.GameStatus(gameData, message))
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

module.exports = GameScore