const Command = require('../../base/Command.js')
const CardDB = require('../../db/carddecks.js')
const Discord = require('discord.js')
const _ = require('lodash')

class Hand extends Command {
    constructor(client) {
        super(client, {
            name: "cards-hand",
            description: "Shows the cards you have in your hand",
            category: "Cards",
            usage: "use this command to DM you your hand",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: false,
            aliases: ["card-hand", "chand"],
            permLevel: "User"
        })
    }

    async run(message, args, level) {
        try {
            let gameData = Object.assign({}, _.cloneDeep(CardDB.defaultGameData), this.client.getGameData(`cards-${message.channel.id}`))
            let player = _.find(gameData.players, {userId: message.author.id})
            if (!player) {
                await message.reply('You have no cards')
            } else {
                let handE = CardDB.handEmbed(player, message.guild.name, message.channel.name)
                message.author.send(handE)
            }

        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

    
}

module.exports = Hand