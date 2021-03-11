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
            enabled: false,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["card-draw"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            let gameData = Object.assign({}, _.cloneDeep(CardDB.defaultGameData), this.client.getGameData(`cards-${message.channel.id}`))
            if (!args[0]) {
                if (gameData.decks.length == 1) {
                    Draw.AddPlayer(gameData, message)
                    let card = Draw.DrawFrom(gameDate, gameData.decks[0], message.author.id)
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                } else {
                    await message.reply("please include the name of the deck to draw from")
                }
            } else {
                let deck = _.find(gameData.decks, {'name': args[0]})
                if (deck){
                    
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

    static DrawFrom(gameData, deck, userId){
        if (deck.currentDeck.length > 0) {
            const card = deck.currentDeck.shift()
            
        } else {
            message.reply(`${deck.name} is empty, maybe you should shuffle?`)
        }
    }

    static AddPlayer(gameData, message){
        if (_.find(gameData.players, {userId: message.author.id})){
            return
        } else {
            gameData.players.push(Object.assign({}, _.cloneDeep(CardDB.defaultPlayer), {userId: message.author.id, guildId: message.guild.id, order: gameData.players.length() + 1}))
        }
    }
}

module.exports = Draw