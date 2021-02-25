const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const _ = require('lodash')
const bazaarData = require('../../db/bazaar.js')
const BazaarFormatter = require('../../modules/BazaarFormatter.js')

const scoregrid = [[5,8,12],[3,5,8],[2,3,5],[1,2,3]]

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
            if (gameData.players === undefined || gameData.gameOver) {
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
                    await msg.edit('No reaction after 30 seconds, turn attempt canceled - try again when ready');
                    await msg.suppressEmbeds(true)
                    await msg.reactions.removeAll()
                    return
                }
                
                if (collected.first().emoji.name == '🎲') {
                    let dieroll = _.sample(["🔵","🟢","🔴","⚪","🟡","🌈"])
                    
                    if (dieroll == "🌈") {
                        const bazaarEmbed2 = new Discord.MessageEmbed().setColor(386945).setTitle("You Rolled a Wild!").setTimestamp()
                        bazaarEmbed2.addField("Pick a color", "Choose which color you'd like")
                        await msg.suppressEmbeds(true)
                        await msg.reactions.removeAll()
                        await msg.edit(bazaarEmbed2)
                        msg.react("🔵").then(r => msg.react("🟢").then(r => msg.react("🔴").then(r => msg.react("⚪").then(r => msg.react("🟡")))))

                        try {
                            var collected2 = await msg.awaitReactions((reaction, user) => user.id == currentPlayer 
                                && (reaction.emoji.name == '🔵' || reaction.emoji.name == '🟢' || reaction.emoji.name == '🔴' || reaction.emoji.name == '⚪' || reaction.emoji.name == '🟡'),
                                { max: 1, time: 30000 })
                        } catch {
                            await msg.edit('No reaction after 30 seconds, turn attempt canceled - try again when ready');
                            await msg.suppressEmbeds(true)
                            await msg.reactions.removeAll()
                            return
                        }

                        dieroll = collected2.first().emoji.name
                    }

                    Action.ClaimDieToken(gameData, dieroll)

                    this.client.setGameData(`bazaar-${message.channel.id}`, gameData)
                    await msg.edit(`You Rolled ${dieroll}`)
                    await msg.suppressEmbeds(true)
                    await msg.reactions.removeAll()
                    
                    this.client.TryExecuteCommand("bazaar-game", message, ["true"])
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
                        await msg.edit('No reaction after 30 seconds, turn attempt canceled - try again when ready');
                        await msg.suppressEmbeds(true)
                        await msg.reactions.removeAll()
                        return
                    }

                    await msg.edit(`You Picked ${collectedObjective.first().emoji.name}`)
                    let claimedScore = Action.ClaimObjective(gameData, collectedObjective.first().emoji.name)
                    this.client.setGameData(`bazaar-${message.channel.id}`, gameData)
                    if (claimedScore > 0) {
                        await msg.edit(`You claimed the Objective and scored ${claimedScore} points`)
                        this.client.setGameData(`bazaar-${message.channel.id}`, gameData)
                    } else {
                        await msg.edit('You are not able to claim that objective');
                    }

                    await msg.suppressEmbeds(true)
                    await msg.reactions.removeAll()
                    this.client.TryExecuteCommand("bazaar-game", message, ["true"])
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
                        await msg.edit('No reaction after 60 seconds, turn attempt canceled - try again when ready');
                        await msg.suppressEmbeds(true)
                        await msg.reactions.removeAll()
                        return
                    }

                    let selectedBazaar = Action.GetSelectedBazaar(gameData, collectedSwap.first().emoji.name)
                    const exchangeEmbed2 = new Discord.MessageEmbed().setColor(386945).setTitle("Which direction do you want to swap").setTimestamp()
                    exchangeEmbed2.addField(`Exchanges`, `${BazaarFormatter.bazaarLeftRightFormat(selectedBazaar)}`)
                    await msg.suppressEmbeds(true)
                    await msg.reactions.removeAll()
                    await msg.edit(exchangeEmbed2)
                    msg.react("📤").then(r => msg.react("📥"))
                    try {
                        var collectedDirection = await msg.awaitReactions((reaction, user) => user.id == currentPlayer 
                            && (reaction.emoji.name == '📤' || reaction.emoji.name == '📥'),
                            { max: 1, time: 30000 })
                    } catch {
                        await msg.edit('No reaction after 30 seconds, turn attempt canceled - try again when ready');
                        await msg.suppressEmbeds(true)
                        await msg.reactions.removeAll()
                        return
                    }
                    
                    if (Action.ClaimExchange(gameData, selectedBazaar, collectedDirection.first().emoji.name) < 0) {
                        await msg.edit('You were not able to make the exchange');
                        return
                    } else {
                        await msg.edit('Thanks for shopping at the Bazaar!');
                        this.client.setGameData(`bazaar-${message.channel.id}`, gameData)
                    }

                    await msg.suppressEmbeds(true)
                    await msg.reactions.removeAll()
                    this.client.TryExecuteCommand("bazaar-game", message, ["true"])
                }

                
            }
            
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }

    static ClaimObjective(gameData, choice){
        let objective = {};
        switch(choice){
            case "🇦":
                objective = gameData.objectiveA[0]
                break;
            case "🇧":
                objective = gameData.objectiveB[0]
                break;
            case "🇨":
                objective = gameData.objectiveC[0]
                break;
            case "🇩":
                objective = gameData.objectiveD[0]
                break;
                            
        }
        //Test Claim
        if (objective === undefined) return -1
        let currentHand = [...gameData.players.find(p => p.order == gameData.turn).hand]
        
        for (let i = 0; i < 5; i++) {
            const index = _.findIndex(currentHand, h => h == objective.goal[i])
            if (index == -1) return -1
            currentHand.splice(index, 1)
        }
        //update hand
        gameData.players.find(p => p.order == gameData.turn).hand = [...currentHand]

        //Score
        let remaining = gameData.players.find(p => p.order == gameData.turn).hand.length
        if (remaining > 3) remaining = 3
        let score = scoregrid[remaining][objective.stars]

        gameData.players.find(p => p.order == gameData.turn).score += score
        //cleanup
        switch(choice){
            case "🇦":
                gameData.objectiveA.splice(0, 1)
                if (gameData.objectiveA.length == 0) Action.AddStars(gameData)
                break;
            case "🇧":
                gameData.objectiveB.splice(0, 1)
                if (gameData.objectiveB.length == 0) Action.AddStars(gameData)
                break;
            case "🇨":
                gameData.objectiveC.splice(0, 1)
                if (gameData.objectiveC.length == 0) Action.AddStars(gameData)
                break;
            case "🇩":
                gameData.objectiveD.splice(0, 1)
                if (gameData.objectiveD.length == 0) Action.AddStars(gameData)
                break;          
        }
        Action.NextTurn(gameData)
        return score

    }

    static GetSelectedBazaar(gameData, choice){
        switch(choice){
            case "1️⃣":
                return gameData.theBazaar[0].trades[0]
            case "2️⃣":
                return gameData.theBazaar[0].trades[1]
            case "3️⃣":
                return gameData.theBazaar[0].trades[2]
            case "4️⃣":
                return gameData.theBazaar[0].trades[3]
            case "5️⃣":
                return gameData.theBazaar[0].trades[4]
            case "6️⃣":
                return gameData.theBazaar[1].trades[0]
            case "7️⃣":
                return gameData.theBazaar[1].trades[1]
            case "8️⃣":
                return gameData.theBazaar[1].trades[2]
            case "9️⃣":
                return gameData.theBazaar[1].trades[3]
            case "🔟":
                return gameData.theBazaar[1].trades[4]
        }
    }

    static ClaimExchange(gameData, choice, direction){
        let currentHand = [...gameData.players.find(p => p.order == gameData.turn).hand]
        switch (direction){
            case "📤":
                for (let i = 0; i < choice.left.length; i++) {
                    const index = _.findIndex(currentHand, h => h == choice.left[i])
                    if (index == -1) return -1
                    currentHand.splice(index, 1)
                }
                gameData.players.find(p => p.order == gameData.turn).hand = [...currentHand,...choice.right]
            break;
            case "📥":
                for (let i = 0; i < choice.right.length; i++) {
                    const index = _.findIndex(currentHand, h => h == choice.right[i])
                    if (index == -1) return -1
                    currentHand.splice(index, 1)
                }
                gameData.players.find(p => p.order == gameData.turn).hand = [...currentHand,...choice.left]
            break
        }
        Action.NextTurn(gameData)
        return 1
    }

    static ClaimDieToken(gameData, dieroll){
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
        Action.NextTurn(gameData)
    }

    static NextTurn(gameData){
        gameData.turn = (gameData.turn % gameData.players.length) + 1
        let emptyCount = 0
        if (gameData.objectiveA.length == 0) emptyCount += 1
        if (gameData.objectiveB.length == 0) emptyCount += 1
        if (gameData.objectiveC.length == 0) emptyCount += 1
        if (gameData.objectiveD.length == 0) emptyCount += 1
        if (emptyCount >= 2) gameData.gameOver = true
    }

    static AddStars(gameData){
        for (let i = 0; i < gameData.objectiveA.length; i++) {
            gameData.objectiveA[i].stars += 1 
        }
        for (let i = 0; i < gameData.objectiveB.length; i++) {
            gameData.objectiveB[i].stars += 1
        }
        for (let i = 0; i < gameData.objectiveC.length; i++) {
            gameData.objectiveC[i].stars += 1
        }
        for (let i = 0; i < gameData.objectiveD.length; i++) {
            gameData.objectiveD[i].stars += 1
        }
    }

}

module.exports = Action