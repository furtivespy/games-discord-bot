const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const _ = require('lodash')



class Bazaar extends Command {
    constructor(client){
        super(client, {
            name: "bazaar",
            description: "Bazaar Game Helper",
            category: "Bazaar",
            usage: "use this command to get Bazaar Help",
            enabled: true,
            guildOnly: false,
            allMessages: false,
            showHelp: true,
            aliases: ["bazaar-help"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            if (args[0]) {
                const newCmd = args.shift()
                this.client.TryExecuteCommand("bazaar-" + newCmd, message, args)
            } else {
                const bazaarEmbed = new Discord.MessageEmbed().setColor(2770926).setTitle("Bazaar Game Help").setTimestamp()
                bazaarEmbed.addField(`Commands`, `
                **Game**  - Current Game Status
                **NewGame**  - Start a new game. Will overwrite current game in the channel. Needs players. e.g. \`&bazaar newgame @furtivespy\`
                **Rules** - Displays the rules of Bazaar
                **Market** - Shows the current exchange market
                **Action** - When it's your turn, use action to take turn`)
                bazaarEmbed.addField(`Reminder`, `All commands for bazaar game start with &bazaar`)
                await message.channel.send(bazaarEmbed);
            }
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }

}

module.exports = Bazaar