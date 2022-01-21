const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const _ = require('lodash')

class Help extends Command {
    constructor(client){
        super(client, {
            name: "rats-help",
            description: "Help for all the Rats game commands",
            category: "Rats",
            usage: "use this command to get rats Help",
            enabled: true,
            guildOnly: false,
            allMessages: false,
            showHelp: true,
            aliases: ["rats-help", "rathelp", "ratshelp"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            const ratsEmbed = new Discord.MessageEmbed().setColor(5582350).setTitle("Rat Game Helper Help").setTimestamp().setDescription('**Commands:**')
         
            ratsEmbed.addField(`Rats`, `Basic command that shows this help\n \`&rats\``, true)
            ratsEmbed.addField(`Scavenge`, `Roll some scavenge rolls\n \`&rats scavenge\``, true)
            //ratsEmbed.addField(`Remove`, `Removes a deck from the channel\n \`&rats remove deckname\``, true)
            //ratsEmbed.addField(`Shuffle`, `Shuffles a deck (newly added decks will not be shuffled at first)\n \`&rats shuffle deckname\``, true)
            //ratsEmbed.addField(`Flip`, `Flips the top card(s) off the deck\n \`&rats flip deckname [number]\``, true)
            //ratsEmbed.addField(`Draw`, `Draw a card from a deck into your hand\n \`&rats draw deckname\``, true)
            //ratsEmbed.addField(`Hand`, `Let's you see the rats in your hand\n \`&rats hand\``, true)
            //ratsEmbed.addField(`Discard`, `Discard a card\n \`&rats discard\``, true)
            //ratsEmbed.addField(`Deal`, `Nothing Yet\n \`&rats\``, true)
            ratsEmbed.addField(`Reminder`, `All commands for this game start with \`&rats\` or \`&rat\`. If you need rules or to print a character sheet visit https://www.shutupandsitdown.com/rats/`)
            await message.channel.send({embeds: [ratsEmbed]});
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

}

module.exports = Help