const Command = require('../../base/Command.js')
const CardDB = require('../../db/carddecks.js')
const Discord = require('discord.js')
const _ = require('lodash')

class Flip extends Command {
    constructor(client) {
        super(client, {
            name: "cards-flip",
            description: "Flip a card from the top of the deck (to discard)",
            category: "Cards",
            usage: "use this command to flip a card - needs a deck name",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["card-flip"],
            permLevel: "User"
        })
    }

    async run(message, args, level) {
        try {
            let gameData = Object.assign({}, _.cloneDeep(CardDB.defaultGameData), this.client.getGameData(`cards-${message.channel.id}`))
            if (!args[0]) {
                if (gameData.decks.length == 1) {
                    Flip.FlipCard(message, gameData.decks[0])
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                } else {
                    await message.reply("please include the name of the deck to flip a card from")
                }
            } else {
                let deck = _.find(gameData.decks, {
                    'name': args[0]
                })
                if (deck) {
                    Flip.FlipCard(message, deck)
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                } else {
                    await message.reply(`unable to find a deck named ${args[0]}`)
                }
            }

        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

    static async FlipCard(message, deck) {
        if (deck.currentDeck.length > 0) {
            const card = deck.currentDeck.shift()
            deck.discard.push(card)
            await message.channel.send("You Flipped:")
            await message.channel.send(`${card}`)
        } else {
            message.reply(`${deck.name} is empty, maybe you should shuffle?`)
        }
    }
}

module.exports = Flip