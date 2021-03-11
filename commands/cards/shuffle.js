const Command = require('../../base/Command.js')
const CardDB = require('../../db/carddecks.js')
const Discord = require('discord.js')
const _ = require('lodash')

class Shuffle extends Command {
    constructor(client){
        super(client, {
            name: "cards-shuffle",
            description: "Card deck shuffler",
            category: "Cards",
            usage: "use this command to shuffle a deck of cards",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["card-shuffle"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            let gameData = Object.assign({}, _.cloneDeep(CardDB.defaultGameData), this.client.getGameData(`cards-${message.channel.id}`))
            if (!args[0]) {
                if (gameData.decks.length == 1) {
                    Shuffle.ShuffleDeck(gameData.decks[0])
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                } else {
                    await message.reply("please include the name of the deck to shuffle")
                }
            } else {
                let deck = _.find(gameData.decks, {'name': args[0]})
                if (deck){
                    Shuffle.ShuffleDeck(deck)
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                } else {
                    await message.reply(`unable to find a deck named ${args[0]}`)
                }
            }
            this.client.TryExecuteCommand("cards", message, [])
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

    static ShuffleDeck(deck){
        deck.currentDeck = _.shuffle([...deck.currentDeck,...deck.discard])
        deck.discard = []
    }
}

module.exports = Shuffle