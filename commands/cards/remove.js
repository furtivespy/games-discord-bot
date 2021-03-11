const Command = require('../../base/Command.js')
const CardDB = require('../../db/carddecks.js')
const Discord = require('discord.js')
const _ = require('lodash')

class Remove extends Command {
    constructor(client){
        super(client, {
            name: "cards-remove",
            description: "Card deck remover",
            category: "Cards",
            usage: "use this command to remove a deck of cards",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["card-remove"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            let gameData = Object.assign({}, _.cloneDeep(CardDB.defaultGameData), this.client.getGameData(`cards-${message.channel.id}`))
            if (!args[0]) {
                    await message.reply("please include the name of the deck to remove")
            } else {
                let deck = _.find(gameData.decks, {'name': args[0]})
                if (deck){
                    _.remove(gameData.decks, {'name': args[0]})
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

}

module.exports = Remove