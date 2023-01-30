const Command = require('../../base/Command.js')
const _ = require('lodash')
const InisFormatter = require('../../modules/InisFormatter.js')


class ViewDiscard extends Command {
    constructor(client){
        super(client, {
            name: "inis-viewdiscard",
            description: "view the set aside season card",
            category: "Inis",
            usage: "use this command to see the set aside season card",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["inis-viewaside","inis-viewsetaside","inis-seediscard","inis-seesetaside"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var gameData = await this.client.getGameData("INIS")
            message.reply(`DM sent with set aside card`)

            message.author.send({embeds: [InisFormatter.createCardEmbed(gameData.greenDeck.slice(-1)[0], "Set Aside Card")]})

        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = ViewDiscard