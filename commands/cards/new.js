const Command = require('../../base/Command.js')
const CardDB = require('../../db/carddecks.js')
const Discord = require('discord.js')
const _ = require('lodash')

class New extends Command {
    constructor(client){
        super(client, {
            name: "cards-new",
            description: "Add new deck of cards to a channel's game",
            category: "Cards",
            usage: "use this command to add card decks",
            enabled: true,
            guildOnly: false,
            allMessages: false,
            showHelp: true,
            aliases: ["card-new"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            let gameData = Object.assign({}, _.cloneDeep(CardDB.defaultGameData), this.client.getGameData(`cards-${message.channel.id}`))
            if (!args[0] || !args[1]) {
                const cardsEmbed = new Discord.MessageEmbed().setColor(13928716).setTitle("Add Deck for Use in Channel").setTimestamp()
                let deckList = ""
                for (let i = 0; i < CardDB.deckList.length; i++) {
                    deckList += `**${CardDB.deckList[i].name}** - ${CardDB.deckList[i].description}\n`
                }
                cardsEmbed.addField(`Avaialble Decks`, deckList)
                cardsEmbed.addField(`Instructions`, `To add a deck use command in form of &cards new local-name deck_name
                e.g. \`&cards new MyDeck playing_cards\``)

                await message.channel.send(cardsEmbed)

            } else {
                if (CardDB[args[1]]) {
                    if (_.find(gameData.decks, {'name': args[0]})) {
                        await message.reply(`A deck named ${args[0]} already exists in this channel`)
                    } else {
                        gameData.decks.push({name: args[0], allCards: [...CardDB[args[1]]], currentDeck: [...CardDB[args[1]]], discard: []})
                        
                        this.client.setGameData(`cards-${message.channel.id}`, gameData)
                        await message.reply(`added ${args[0]} to this channels cards`)
                    }
                }
            }
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

}

module.exports = New