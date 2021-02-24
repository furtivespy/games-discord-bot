const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const _ = require('lodash')
const bazaarData = require('../../db/bazaar.js')
const BazaarFormatter = require('../../modules/BazaarFormatter.js')


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
                    return;
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
                    await msg.edit(`You Rolled ${dieroll}`)
                    msg.suppressEmbeds(true)
                    msg.reactions.removeAll()
                    
                    this.client.TryExecuteCommand("bazaar-game", message, [])
                }
                if (collected.first().emoji.name == '⭐') {
                    const objectiveEmbed = new Discord.MessageEmbed().setColor(386945).setTitle("Which Objective Are You Claiming").setTimestamp()
                    objectiveEmbed.addField(`Objectives`,`
:regional_indicator_a::arrow_right:  ${BazaarFormatter.objectiveFormat(gameData.objectiveA[0])} (${gameData.objectiveA.length})
:regional_indicator_b::arrow_right:  ${BazaarFormatter.objectiveFormat(gameData.objectiveB[0])} (${gameData.objectiveB.length})
:regional_indicator_c::arrow_right:  ${BazaarFormatter.objectiveFormat(gameData.objectiveC[0])} (${gameData.objectiveC.length})
:regional_indicator_d::arrow_right:  ${BazaarFormatter.objectiveFormat(gameData.objectiveD[0])} (${gameData.objectiveD.length})`)
                    await msg.suppressEmbeds(true)
                    await msg.reactions.removeAll()
                    await msg.edit(objectiveEmbed)
                    msg.react("🇦").then(r => msg.react("🇧").then(r => msg.react("🇨").then(r => msg.react("🇩"))))

                    try {
                        var collectedObjective = await msg.awaitReactions((reaction, user) => user.id == currentPlayer 
                            && (reaction.emoji.name == '🇦' || reaction.emoji.name == '🇧' || reaction.emoji.name == '🇨' || reaction.emoji.name == '🇩'),
                            { max: 1, time: 30000 })
                    } catch {
                        msg.edit('No reaction after 30 seconds, turn attempt canceled - try again when ready');
                        msg.suppressEmbeds(true)
                        msg.reactions.removeAll()
                        return
                    }

                    await msg.edit(`You Picked ${collectedObjective.first().emoji.name}`)
                    msg.suppressEmbeds(true)
                    msg.reactions.removeAll()

                }
                if (collected.first().emoji.name == '🛍') {

                    const exchangeEmbed = new Discord.MessageEmbed().setColor(386945).setTitle("Which Swap do you want to make").setTimestamp()
                    exchangeEmbed.addField(`Exchanges`, `${BazaarFormatter.bazaarFormat([...gameData.theBazaar[0].trades,...gameData.theBazaar[1].trades])}`)
                    await msg.suppressEmbeds(true)
                    await msg.reactions.removeAll()
                    await msg.edit(exchangeEmbed)
                    msg.react("1️⃣").then(r => msg.react("2️⃣").then(r => msg.react("3️⃣").then(r => msg.react("4️⃣").then(r => msg.react("5️⃣")
                    .then(r => msg.react("6️⃣").then(r => msg.react("7️⃣").then(r => msg.react("8️⃣").then(r => msg.react("9️⃣").then(r => msg.react("🔟"))))))))))

                    try {
                        var collectedSwap = await msg.awaitReactions((reaction, user) => user.id == currentPlayer 
                            && (reaction.emoji.name == '1️⃣' || reaction.emoji.name == '2️⃣' || reaction.emoji.name == '3️⃣' || reaction.emoji.name == '4️⃣' || reaction.emoji.name == '5️⃣'
                             || reaction.emoji.name == '6️⃣' || reaction.emoji.name == '7️⃣' || reaction.emoji.name == '8️⃣' || reaction.emoji.name == '9️⃣' || reaction.emoji.name == '🔟'),
                            { max: 1, time: 60000 })
                    } catch {
                        msg.edit('No reaction after 60 seconds, turn attempt canceled - try again when ready');
                        msg.suppressEmbeds(true)
                        msg.reactions.removeAll()
                        return
                    }

                    await msg.edit(`You Picked ${collectedSwap.first().emoji.name}`)
                    msg.suppressEmbeds(true)
                    msg.reactions.removeAll()
                }

                
            }
            
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }

}

module.exports = Action