const Command = require('../../base/Command.js')
const _ = require('lodash')
const InisFormatter = require('../../modules/InisFormatter.js')


class Brenn extends Command {
    constructor(client){
        super(client, {
            name: "inis-brenn",
            description: "assign a new brenn",
            category: "Inis",
            usage: "use this command to assign the brenn",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["newbrenn"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var newBrenn = this.getUserFromMention(args[0])
            if (!newBrenn) return

            var gameData = this.client.getGameData("INIS")

            gameData.players.forEach(p => {
                p.isBrenn = p.userId == newBrenn.id
            })
            if (!gameData.players.find(p => p.isBrenn)) return
            this.client.setGameData("INIS", gameData)
            await message.channel.send({embeds: [await InisFormatter.gameStatus(this.client, gameData)]})
        } catch (e) {
            this.client.logger.log(e,'error')
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

module.exports = Brenn