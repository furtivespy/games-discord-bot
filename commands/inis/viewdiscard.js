const Command = require('../../base/Command.js')
const _ = require('lodash')
const InisFormatter = require('../../modules/InisFormatter.js')


class ViewDiscard extends Command {
    constructor(client){
        super(client, {
            name: "viewdiscard",
            description: "view the set aside season card",
            category: "Inis",
            usage: "use this command to see the set aside season card",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["viewaside","viewsetaside","seediscard","seesetaside"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var gameData = this.client.getGameData("INIS")
            message.reply(`DM sent with set aside card`)

            message.author.send(InisFormatter.createCardEmbed(gameData.greenDeck.slice(-1)[0], "Set Aside Card"))

        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = ViewDiscard