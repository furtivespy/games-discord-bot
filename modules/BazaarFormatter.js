const Discord = require('discord.js')
const _ = require('lodash')
const { objectives } = require('../db/bazaar.js')
const bazaarData = require('../db/bazaar.js')


class BazaarFormatter {
    static async gameStatus(client, gameData){
        const guild = await client.guilds.fetch(gameData.players[0].guildId)
        const statusEmbed = new Discord.MessageEmbed().setColor(2770926).setTitle("Current Game Status").setTimestamp()

        statusEmbed.addField(`Objectives`,`
:regional_indicator_a::arrow_right:  ${this.objectiveFormat(gameData.objectiveA[0])} (${gameData.objectiveA.length})
:regional_indicator_b::arrow_right:  ${this.objectiveFormat(gameData.objectiveB[0])} (${gameData.objectiveB.length})
:regional_indicator_c::arrow_right:  ${this.objectiveFormat(gameData.objectiveC[0])} (${gameData.objectiveC.length})
:regional_indicator_d::arrow_right:  ${this.objectiveFormat(gameData.objectiveD[0])} (${gameData.objectiveD.length})`)

        let playerlist = "";
        await Promise.all(_.orderBy(gameData.players, 'order').map(async (player) => {
            var user = await guild.members.fetch(player.userId)
            playerlist += `${user.displayName} (${player.score} points) : ${this.playerHandFormat(player)}\n`
        }))
        statusEmbed.addField(`Players`,playerlist)
        var activePlayer = await guild.members.fetch(gameData.players.find(p => p.order == gameData.turn).userId)
        statusEmbed.addField(`Turn`, `It is ${activePlayer.displayName}'s turn - use "&bazaar action" to play`)
        return statusEmbed
    }

    static async gameOver(client, gameData){
        const guild = await client.guilds.fetch(gameData.players[0].guildId)
        const statusEmbed = new Discord.MessageEmbed().setColor(2770926).setTitle("Game Over!").setTimestamp()
        let playerlist = "";
        await Promise.all(_.orderBy(gameData.players, 'score', 'desc').map(async (player) => {
            var user = await guild.members.fetch(player.userId)
            playerlist += `${user.displayName} (${player.score} points) : ${this.playerHandFormat(player)}\n`
        }))
        statusEmbed.addField(`Congratulations`,playerlist)
        return statusEmbed
    }

    static bazaarEmbed(gameData){
        const statusEmbed = new Discord.MessageEmbed().setColor(2770926).setTitle("The Bazaar").setTimestamp()
        statusEmbed.addField(`Exchanges`, this.bazaarFormat([...gameData.theBazaar[0].trades,...gameData.theBazaar[1].trades]))
        statusEmbed.addField('Debug', `Bazaar Ids: ${gameData.theBazaar[0].marketId} and ${gameData.theBazaar[1].marketId}`)
        return statusEmbed
    }


    static bazaarFormat(bazaars){
        let stringValue = ``
        for (let i = 0; i < bazaars.length; i++) {
            stringValue += `${this.numberToEmoji(i+1)} - `
            for (let j = 0; j < bazaars[i].left.length; j++) {
                stringValue += this.colorToCircle(bazaars[i].left[j])
            }
            stringValue += ` :left_right_arrow: `
            for (let j = 0; j < bazaars[i].right.length; j++) {
                stringValue += this.colorToCircle(bazaars[i].right[j])
            }
            stringValue += `\n`     
            if (i==4) {
                stringValue += `\n` 
            }    
        }
        return stringValue
    }

    static bazaarLeftRightFormat(bazaar){
        let stringValue = `📤 - `
        for (let j = 0; j < bazaar.left.length; j++) {
            stringValue += this.colorToCircle(bazaar.left[j])
        }
        stringValue += ` ➡ `
        for (let j = 0; j < bazaar.right.length; j++) {
            stringValue += this.colorToCircle(bazaar.right[j])
        }
        stringValue += `\n\n`   
        stringValue += `📥 - `
        for (let j = 0; j < bazaar.right.length; j++) {
            stringValue += this.colorToCircle(bazaar.right[j])
        }
        stringValue += ` ➡ `
        for (let j = 0; j < bazaar.left.length; j++) {
            stringValue += this.colorToCircle(bazaar.left[j])
        }
        stringValue += `\n`  

        return stringValue
    }

    static objectiveFormat(objective){
        if (objective === undefined) return ""
        let stringValue = `${this.colorToCircle(objective.goal[0])} ${this.colorToCircle(objective.goal[1])} ${this.colorToCircle(objective.goal[2])} ${this.colorToCircle(objective.goal[3])} ${this.colorToCircle(objective.goal[4])} `
        for (let i = 0; i < objective.stars; i++) {
            stringValue += ":star: "            
        }
        return stringValue 
    }

    static playerHandFormat(player){
        let stringValue = ""
        for (let i = 0; i < player.hand.length; i++) {
            stringValue += this.colorToCircle(player.hand[i])
        }
        return stringValue
    }

    static colorToCircle(colorVal){
        switch(colorVal){
            case bazaarData.colors.BLUE:
                return ":blue_circle:"
            case bazaarData.colors.GREEN:
                return ":green_circle:"
            case bazaarData.colors.RED:
                return ":red_circle:"
            case bazaarData.colors.WHITE:
                return ":white_circle:"
            case bazaarData.colors.YELLOW:
                return ":yellow_circle:"
            default:
                return ":black_circle:"
        }
    }

    static numberToEmoji(numberVal){
        switch(numberVal){
            case 0:
                return ":zero:"
            case 1:
                return ":one:"
            case 2: 
                return ":two:"
            case 3:
                return ":three:"
            case 4: 
                return ":four:"
            case 5:
                return ":five:"
            case 6: 
                return ":six:"
            case 7:
                return ":seven:"
            case 8: 
                return ":eight:"
            case 9:
                return ":nine:"
            case 10:
                return ":keycap_ten:"
            default: 
                return ":1234:"     
        }
    }

}

module.exports = BazaarFormatter