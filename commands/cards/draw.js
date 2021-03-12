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
            if (!args[0]) {
                if (gameData.decks.length == 1) {
                    Draw.AddPlayerAndHand(gameData, gameData.decks[0], message)
                    let card = Draw.DrawFrom(gameData, gameData.decks[0], message.author.id)
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                    if (card) {
                        message.react("🃏")
                        const cardEmbed = new Discord.MessageEmbed().setColor(13928716).setTitle(`You Drew:`).setDescription(card)
                        message.author.send(cardEmbed)
                        this.client.TryExecuteCommand("cards-hand", message, [])
                    }
                } else {
                    await message.reply("please include the name of the deck to draw from")
                }
            } else {
                let deck = _.find(gameData.decks, {'name': args[0]})
                if (deck){
                    Draw.AddPlayerAndHand(gameData, deck, message)
                    let card = Draw.DrawFrom(gameData, deck, message.author.id)
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                    if (card) {
                        message.react("🃏")
                        const cardEmbed = new Discord.MessageEmbed().setColor(13928716).setTitle(`You Drew:`).setDescription(card)
                        message.author.send(cardEmbed)
                        this.client.TryExecuteCommand("cards-hand", message, [])
                    }
                } else {
                    await message.reply(`unable to find a deck named ${args[0]}`)
                }
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