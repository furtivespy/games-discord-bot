const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const _ = require('lodash')
const bazaarData = require('../../db/bazaar.js')


class Action extends Command {
    constructor(client){
        super(client, {
            name: "bazaar-action",
            description: "Bazaar Game Turn",
            category: "Bazaar",
            usage: "use this command to take your turn in Bazaar",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: [],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var gameData = this.client.getGameData(`bazaar-${message.channel.id}`)
            if (gameData.players === undefined) {
                await message.channel.send(`No Game Happening in this Channel`)
            } else {
                let currentPlayer = gameData.players.find(p => p.order == gameData.turn).userId
                if (currentPlayer != message.author.id) {
                    await message.reply(`It is not your turn`)
                }
                const bazaarEmbed = new Discord.MessageEmbed().setColor(386945).setTitle("What do you want to do?").setTimestamp()
                bazaarEmbed.addField(`Actions`, `:game_die: - Roll the die\n:star: - Claim objective\n:shopping_bags: - Make an exchange`)
                
                let msg = await message.channel.send(bazaarEmbed)
                msg.react("🎲").then(r => msg.react("⭐").then(r => msg.react("🛍")))

                try {
                    var collected = await msg.awaitReactions((reaction, user) => user.id == currentPlayer 
                        && (reaction.emoji.name == '🎲' || reaction.emoji.name == '⭐' || reaction.emoji.name == '🛍'),
                        { max: 1, time: 30000 })
                } catch {
                    msg.edit('No reaction after 30 seconds, turn attempt canceled - try again when ready');
                    msg.suppressEmbeds(true)
                    msg.reactions.removeAll()
                    return
                }
                
                if (collected.first().emoji.name == '🎲') {
                    let dieroll = _.sample(["🔵","🟢","🔴","⚪","🟡","🌈"])

                    if (dieroll == "🌈") {
                        const bazaarEmbed2 = new Discord.MessageEmbed().setColor(386945).setTitle("You Rolled a Wild!").setTimestamp()
                        bazaarEmbed2.addField("Pick a color", "Choose which color you'd like")
                        msg.suppressEmbeds(true)
                        msg.reactions.removeAll()
                        msg.edit(bazaarEmbed2)
                        msg.react("🔵").then(r => msg.react("🟢").then(r => msg.react("🔴").then(r => msg.react("⚪").then(r => msg.react("🟡")))))

                        try {
                            var collected2 = await msg.awaitReactions((reaction, user) => user.id == currentPlayer 
                                && (reaction.emoji.name == '🔵' || reaction.emoji.name == '🟢' || reaction.emoji.name == '🔴' || reaction.emoji.name == '⚪' || reaction.emoji.name == '🟡'),
                                { max: 1, time: 30000 })
                        } catch {
                            msg.edit('No reaction after 30 seconds, turn attempt canceled - try again when ready');
                            msg.suppressEmbeds(true)
                            msg.reactions.removeAll()
                            return
                        }

                        dieroll = collected2.first().emoji.name
                    }

                    msg.edit(`You Rolled ${dieroll}`)
                    msg.suppressEmbeds(true)
                    msg.reactions.removeAll()

                    switch(dieroll){
                        case "🔵":
                            gameData.players.find(p => p.order == gameData.turn).hand.push(bazaarData.colors.BLUE)
                            break;
                        case "🟢":
                            gameData.players.find(p => p.order == gameData.turn).hand.push(bazaarData.colors.GREEN)
                            break;
                        case "🔴":
                            gameData.players.find(p => p.order == gameData.turn).hand.push(bazaarData.colors.RED)
                            break;
                        case "⚪":
                            gameData.players.find(p => p.order == gameData.turn).hand.push(bazaarData.colors.WHITE)
                            break;
                        case "🟡":
                            gameData.players.find(p => p.order == gameData.turn).hand.push(bazaarData.colors.YELLOW)
                            break;
                    }

                    this.client.setGameData(`bazaar-${message.channel.id}`, gameData)
                    this.client.TryExecuteCommand("bazaar-game", message, [])
                }
                if (collected.first().emoji.name == '⭐') {
                    message.channel.send('do star!')
                }
                if (collected.first().emoji.name == '🛍') {
                    message.channel.send('do bag!')
                }

                
            }
            
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }

}

module.exports = Action