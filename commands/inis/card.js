const Command = require('../../base/Command.js')
const _ = require('lodash')
const InisFormatter = require('../../modules/InisFormatter.js')


class Card extends Command {
    constructor(client){
        super(client, {
            name: "card",
            description: "Display a card - see its info",
            category: "Inis",
            usage: "use this command to see image and text of a card",
            enabled: true,
            guildOnly: false,
            allMessages: false,
            showHelp: true,
            aliases: ["cardinfo"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var search = InisFormatter.findCard(args.join(" "))
            if (!search) {
                message.reply("No matching card found")
            } else {
                message.channel.send(search)
            }
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

module.exports = Card