const Command = require('../../base/Command.js')
const CardDB = require('../../db/carddecks.js')
const Discord = require('discord.js')
const _ = require('lodash')

class Draw extends Command {
    constructor(client){
        super(client, {
            name: "cards-draw",
            description: "Card deck draw",
            category: "Cards",
            usage: "use this command to draw a card from a deck",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["card-draw", "cdraw"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            let gameData = Object.assign({}, _.cloneDeep(CardDB.defaultGameData), this.client.getGameData(`cards-${message.channel.id}`))
            let count = 1
            let deckName = ""
            if (!args[0]){
                if (gameData.decks.length == 1) {
                    deckName = gameData.decks[0].name
                } else {
                    await message.reply("please include the name of the deck to draw from")
                    this.client.TryExecuteCommand("cards", message, [])
                    return
                }
            } else {
                deckName = args[0]
            }

            if (args[1]) {
                count = super.TryParseInt(args[1], 1)
            }
            
            let deck = _.find(gameData.decks, {'name': deckName})
            if (deck){
                Draw.AddPlayerAndHand(gameData, deck, message)
                const drawnCards = []
                let card = null
                for (let i = 0; i < count; i++) {
                    card = Draw.DrawFrom(gameData, deck, message.author.id)
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                    if (card) {
                        drawnCards.push(card)
                    } else {
                        break
                    }
                    card = null
                }
                if (drawnCards.length > 0) {
                    message.reply(`you drew ${drawnCards.length} ${drawnCards.length > 1 ? "cards" : "card"}`)
                    const cardEmbed = new Discord.MessageEmbed().setColor(13928716).setTitle(`You Drew:`).setDescription(drawnCards.join('\n'))
                    message.author.send(cardEmbed)
                    this.client.TryExecuteCommand("cards-hand", message, [])
                }
            } else {
                await message.reply(`unable to find a deck named ${args[0]}`)
            }
            
            this.client.TryExecuteCommand("cards", message, [])
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

    static DrawFrom(gameData, deck, userId){
        if (deck.currentDeck.length > 0) {
            const player = _.find(gameData.players, {userId: userId})
            const hand = _.find(player.hands, {deck: deck.name})
            const card = deck.currentDeck.shift()
            hand.cards.push(card)
            hand.cards.sort()
            return card
        } else {
            message.reply(`${deck.name} is empty, maybe you should shuffle?`)
        }
    }

    static AddHand(player, deck){
        if (_.find(player.hands, {deck: deck.name})){
            return
        } else {
            player.hands.push(Object.assign({}, _.cloneDeep(CardDB.defaultHand), {deck: deck.name}))
        }
    }

    static AddPlayerAndHand(gameData, deck, message){
        let player = _.find(gameData.players, {userId: message.author.id})
        if (!player){
            player = Object.assign({}, _.cloneDeep(CardDB.defaultPlayer), {userId: message.author.id, guildId: message.guild.id, order: gameData.players.length + 1})
            gameData.players.push(player)
        }
        Draw.AddHand(player, deck)
    }
}

module.exports = Draw