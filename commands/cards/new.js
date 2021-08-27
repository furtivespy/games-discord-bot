const Command = require('../../base/Command.js')
const CardDB = require('../../db/carddecks.js')
const Discord = require('discord.js')
const _ = require('lodash')
const { split } = require('lodash')

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
            showHelp: false,
            aliases: ["card-new", "card-add", "cards-add", "cnew", "cadd"],
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
                let newName = args.shift()
                if (CardDB[args[0]]) {
                    if (_.find(gameData.decks, {'name': newName})) {
                        await message.reply(`A deck named ${newName} already exists in this channel`)
                    } else {
                        gameData.decks.push({name: newName, allCards: [...CardDB[args[0]]], currentDeck: [...CardDB[args[0]]], discard: []})
                        
                        this.client.setGameData(`cards-${message.channel.id}`, gameData)
                        await message.reply(`added ${newName} to this channels cards. Remember to shuffle!`)
                    }
                } else {
                    let newDeck = _.split(args.join(" "), `,`)
                    if (newDeck.length > 1) {
                        gameData.decks.push({name: newName, allCards: [...newDeck], currentDeck: [...newDeck], discard: []})
                        this.client.setGameData(`cards-${message.channel.id}`, gameData)
                        await message.reply(`added ${newName} to this channels cards. Remember to shuffle!`)
                    }
                }
            }
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

}

module.exports = New