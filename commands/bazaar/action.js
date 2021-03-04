const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const _ = require('lodash')
const bazaarData = require('../../db/bazaar.js')
const BazaarFormatter = require('../../modules/BazaarFormatter.js')

const scoregrid = [[5,8,12],[3,5,8],[2,3,5],[1,2,3]]

const defaultHistory = {
    playerName: "",
    action: 0,
    wild: false,
    dieroll: "",
    exchange: "",
    objectiveClaim: false,
    objective: {},
    points: 0
}


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
            aliases: ["bazaar-a", "ba"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            var gameData = this.client.getGameData(`bazaar-${message.channel.id}`)
            if (args[0]) console.log(gameData)
            if (gameData.players === undefined || gameData.gameOver) {
                await message.channel.send(`No Game Happening in this Channel`)
            } else {
                let currentPlayer = gameData.players.find(p => p.order == gameData.turn).userId
                if (currentPlayer != message.author.id) {
                    await message.reply(`It is not your turn`)
                    return;
                }
                let buildHistory =  Object.assign({}, _.cloneDeep(defaultHistory), {playerName: message.member.displayName})
                if (gameData.turnClaim) {
                    //skip this phase if have less than 5 doobs
                    if (gameData.players.find(p => p.order == gameData.turn).hand.length < 5){
                        Action.NextTurn(gameData)
                        this.client.setGameData(`bazaar-${message.channel.id}`, gameData)
                        this.client.TryExecuteCommand("bazaar-game", message, ["true"])
                        return
                    }
                    //skip if can't claim any
                    let clonedGame = _.cloneDeep(gameData)
                    if (Action.ClaimObjective(clonedGame, "🇦", clonedGame.history) > 0 ||
                        Action.ClaimObjective(clonedGame, "🇧", clonedGame.history) > 0 ||
                        Action.ClaimObjective(clonedGame, "🇨", clonedGame.history) > 0 ||
                        Action.ClaimObjective(clonedGame, "🇩", clonedGame.history) > 0 ) {
                        
                        buildHistory = gameData.history
                        const objEmbed = new Discord.MessageEmbed().setColor(386945).setTitle("Would you like to claim an objective?").setTimestamp()
                        objEmbed.addField(`Objectives`,`
:regional_indicator_a::arrow_right:  ${BazaarFormatter.objectiveFormat(gameData.objectiveA[0])} (${gameData.objectiveA.length})
:regional_indicator_b::arrow_right:  ${BazaarFormatter.objectiveFormat(gameData.objectiveB[0])} (${gameData.objectiveB.length})
:regional_indicator_c::arrow_right:  ${BazaarFormatter.objectiveFormat(gameData.objectiveC[0])} (${gameData.objectiveC.length})
:regional_indicator_d::arrow_right:  ${BazaarFormatter.objectiveFormat(gameData.objectiveD[0])} (${gameData.objectiveD.length})
:no_entry_sign::arrow_right:  I do not want to claim an objective`)

                        objEmbed.addField(`Players`, await BazaarFormatter.playerList(this.client, gameData))

                        let objmsg = await message.channel.send(objEmbed)
                        objmsg.react("🇦").then(r => objmsg.react("🇧").then(r => objmsg.react("🇨").then(r => objmsg.react("🇩").then(r => objmsg.react("🚫")))))

                            try {
                                var collectedObjective = await objmsg.awaitReactions((reaction, user) => user.id == currentPlayer 
                                    && (reaction.emoji.name == '🇦' || reaction.emoji.name == '🇧' || reaction.emoji.name == '🇨' || reaction.emoji.name == '🇩' || reaction.emoji.name == '🚫'),
                                    { max: 1, time: 30000 })
                            } catch {
                                collectedObjective = {}
                            }
                            if (!collectedObjective.first()){
                                await objmsg.edit('No reaction after 30 seconds, Claim Attempt canceled - try again when ready');
                                await objmsg.suppressEmbeds(true)
                                await objmsg.reactions.removeAll()
                                this.client.TryExecuteCommand("bazaar-game", message, ["true"])
                                return
                            } else if (collectedObjective.first().emoji.name == '🚫'){
                                Action.NextTurn(gameData)
                                this.client.setGameData(`bazaar-${message.channel.id}`, gameData)
                                await objmsg.suppressEmbeds(true)
                                await objmsg.reactions.removeAll()
                                this.client.TryExecuteCommand("bazaar-game", message, ["true"])
                                return
                            }

                            await objmsg.edit(`You Picked ${collectedObjective.first().emoji.name}`)
                            let claimedScore = Action.ClaimObjective(gameData, collectedObjective.first().emoji.name, buildHistory)
                            gameData.history = buildHistory
                            this.client.setGameData(`bazaar-${message.channel.id}`, gameData)
                            if (claimedScore > 0) {
                                await objmsg.edit(`You claimed the Objective and scored ${claimedScore} points`)
                                this.client.setGameData(`bazaar-${message.channel.id}`, gameData)
                            } else {
                                await objmsg.edit('You are not able to claim that objective');
                            }

                            await objmsg.suppressEmbeds(true)
                            await objmsg.reactions.removeAll()
                            this.client.TryExecuteCommand("bazaar-game", message, ["true"])
                            return

                    } else {
                        Action.NextTurn(gameData)
                        this.client.setGameData(`bazaar-${message.channel.id}`, gameData)
                        this.client.TryExecuteCommand("bazaar-game", message, ["true"])
                        return
                    }
                }
                
                const bazaarEmbed = new Discord.MessageEmbed().setColor(386945).setTitle("What do you want to do?").setTimestamp()
                bazaarEmbed.addField(`Actions`, `:game_die: - Roll the die\n:shopping_bags: - Make an exchange`)
                let msg = await message.channel.send(bazaarEmbed)
                msg.react("🎲").then(r => msg.react("🛍"))
                
                try {
                    var collected = await msg.awaitReactions((reaction, user) => user.id == currentPlayer 
                        && (reaction.emoji.name == '🎲' || reaction.emoji.name == '🛍'),
                        { max: 1, time: 30000 })
                } catch {
                    collected = {}
                }
                if (!collected.first()){
                    await msg.edit('No reaction after 30 seconds, turn attempt canceled - try again when ready');
                    await msg.suppressEmbeds(true)
                    await msg.reactions.removeAll()
                    return
                }
                if (collected.first().emoji.name == '🎲') {
                    let dieroll = _.sample(["🔵","🟢","🔴","⚪","🟡","🌈"])
                    buildHistory.action = 1
                    if (dieroll == "🌈") {
                        buildHistory.wild = true
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
                            collected2 = {}
                        }
                        if (!collected2.first()){
                            await msg.edit('No reaction after 30 seconds, turn attempt canceled - try again when ready');
                            await msg.suppressEmbeds(true)
                            await msg.reactions.removeAll()
                            return
                        }

                        dieroll = collected2.first().emoji.name
                    }
                    buildHistory.dieroll = dieroll
                    Action.ClaimDieToken(gameData, dieroll)
                    gameData.history = buildHistory
                    this.client.setGameData(`bazaar-${message.channel.id}`, gameData)
                    await msg.edit(`You Rolled ${dieroll}`)
                    await msg.suppressEmbeds(true)
                    await msg.reactions.removeAll()
                    
                    this.client.TryExecuteCommand("bazaar-action", message, [])
                }
                if (collected.first().emoji.name == '🛍') {
                    buildHistory.action = 2
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
                        collectedSwap = {}
                    }

                    if (!collectedSwap.first()){
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
                        collectedDirection = {}
                    }
                    if (!collectedDirection.first()){
                        await msg.edit('No reaction after 30 seconds, turn attempt canceled - try again when ready');
                        await msg.suppressEmbeds(true)
                        await msg.reactions.removeAll()
                        return
                    }
                    
                    if (Action.ClaimExchange(gameData, selectedBazaar, collectedDirection.first().emoji.name, buildHistory) < 0) {
                        await msg.edit('You were not able to make the exchange');
                        return
                    } else {
                        await msg.edit('Thanks for shopping at the Bazaar!');
                        gameData.history = buildHistory
                        this.client.setGameData(`bazaar-${message.channel.id}`, gameData)
                    }

                    await msg.suppressEmbeds(true)
                    await msg.reactions.removeAll()
                    this.client.TryExecuteCommand("bazaar-action", message, [])
                }

                
            }
            
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

    

    static ClaimObjective(gameData, choice, history){
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
        history.objectiveClaim = true
        history.objective = objective
        history.points = score
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

    static ClaimExchange(gameData, choice, direction, history){
        let currentHand = [...gameData.players.find(p => p.order == gameData.turn).hand]
        switch (direction){
            case "📤":
                for (let i = 0; i < choice.left.length; i++) {
                    const index = _.findIndex(currentHand, h => h == choice.left[i])
                    if (index == -1) return -1
                    currentHand.splice(index, 1)
                }
                history.exchange = BazaarFormatter.bazaarFormatDirection("right", choice)
                gameData.players.find(p => p.order == gameData.turn).hand = [...currentHand,...choice.right]
            break;
            case "📥":
                for (let i = 0; i < choice.right.length; i++) {
                    const index = _.findIndex(currentHand, h => h == choice.right[i])
                    if (index == -1) return -1
                    currentHand.splice(index, 1)
                }
                history.exchange = BazaarFormatter.bazaarFormatDirection("left", choice)
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
        if (gameData.turnClaim) {
            gameData.turn = (gameData.turn % gameData.players.length) + 1
            let emptyCount = 0
            if (gameData.objectiveA.length == 0) emptyCount += 1
            if (gameData.objectiveB.length == 0) emptyCount += 1
            if (gameData.objectiveC.length == 0) emptyCount += 1
            if (gameData.objectiveD.length == 0) emptyCount += 1
            if (emptyCount >= 2) gameData.gameOver = true
            gameData.turnClaim = false
        } else {
            gameData.turnClaim = true
        }
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