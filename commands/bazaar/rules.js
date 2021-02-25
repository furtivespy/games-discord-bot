const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const _ = require('lodash')
var AsciiTable = require('ascii-table')


class Rules extends Command {
    constructor(client){
        super(client, {
            name: "bazaar-rules",
            description: "Bazaar Game Helper",
            category: "Bazaar",
            usage: "use this command to get Bazaar Help",
            enabled: true,
            guildOnly: false,
            allMessages: false,
            showHelp: true,
            aliases: ["bazaar-r"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var table = new AsciiTable('[Point Values]')
            table.setHeading("Tokens Remaining", "0 Stars", "1 Star", "2 Stars")
            table.addRow("3 or more", "1", "2", "3")
            table.addRow("2", "2", "3", "5")
            table.addRow("1", "3", "5", "8")
            table.addRow("0", "5", "8", "12")
            let scoring = "When exchanging for an objective, points are determined by the number of tokens remaining after the sale and the number of :star: on the objective\n"
            scoring += "```css\n"
            scoring += table.toString()
            scoring += "```"
            const bazaarEmbed = new Discord.MessageEmbed().setColor(386945).setTitle("Bazaar Game Rules").setTimestamp()
            bazaarEmbed.addField(`Objective`, `Through skillful trading and re-trading, be the player with the most points by the end of the game!`)
            bazaarEmbed.addField(`Play`, `On a player's turn they can either roll the die for a new token or make an exchange for either tokens at the excange or an objective for points`)
            bazaarEmbed.addField(`Scoring`, scoring)
            bazaarEmbed.addField(`Game End`, `When all objectives from 2 stalls are gone, the game ends. (The count of objectives in the stall is in parentheses - at the start of the game it is 5 in each)`)
            await message.channel.send(bazaarEmbed);
            
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }

}

module.exports = Rules