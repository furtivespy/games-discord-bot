const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const _ = require('lodash')

class Help extends Command {
    constructor(client){
        super(client, {
            name: "cards-help",
            description: "Card Game Helper",
            category: "Cards",
            usage: "use this command to get Cards Help",
            enabled: true,
            guildOnly: false,
            allMessages: false,
            showHelp: true,
            aliases: ["card-help", "chelp"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            const cardsEmbed = new Discord.MessageEmbed().setColor(13928716).setTitle("Card Game Helper Help").setTimestamp().setDescription('**Commands:**')
            // cardsEmbed.addField(`Commands`, `
            // **Cards**  - Basic command that shows active card decks in the channel
            // **New**  - Add a new deck to the channel (use without parameters to get specific help)
            // **Remove**  - Removes a deck from the channel
            // **Shuffle** - Shuffles a deck (newly added decks will not be shuffled at first)
            // **Flip** - Flips the top card(s) off the deck
            // **Deal** - Nothing Yet`)
            cardsEmbed.addField(`Cards`, `Basic command that shows active card decks in the channel\n \`&cards\``, true)
            cardsEmbed.addField(`New`, `Add a new deck to the channel (use without parameters to get detailed help)\n \`&cards new\``, true)
            cardsEmbed.addField(`Remove`, `Removes a deck from the channel\n \`&cards remove deckname\``, true)
            cardsEmbed.addField(`Shuffle`, `Shuffles a deck (newly added decks will not be shuffled at first)\n \`&cards shuffle deckname\``, true)
            cardsEmbed.addField(`Flip`, `Flips the top card(s) off the deck\n \`&cards flip deckname [number]\``, true)
            cardsEmbed.addField(`Draw`, `Draw a card from a deck into your hand\n \`&cards draw deckname\``, true)
            cardsEmbed.addField(`Discard`, `Discard a card\n \`&cards discard\``, true)
            //cardsEmbed.addField(`Deal`, `Nothing Yet\n \`&cards\``, true)
            cardsEmbed.addField(`Reminder`, `All commands for card game start with \`&cards\` or \`&c\``)
            await message.channel.send(cardsEmbed);
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

}

module.exports = Help