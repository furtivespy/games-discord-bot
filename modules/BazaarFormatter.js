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
            playerlist += `${user.displayName} (${player.score} points) : ${this.objectivesplayerHandFormat(player)}\n`
        }))
        statusEmbed.addField(`Players`,playerlist)
        statusEmbed.addField(`Turn`, `It is ${gameData.turn}'s turn - use "&bazaar action" to play`)
        return statusEmbed
    }

    static objectiveFormat(objective){
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
                return ":green_circle:"
            case bazaarData.colors.GREEN:
                return ":blue_circle:"
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

    static createCardEmbed(cardData, title){
        const cardEmbed = new Discord.MessageEmbed().setTitle(cardData.name).setDescription(cardData.text).setAuthor(title)
        // switch (cardData.type) {
        //     case "season":
        //         cardEmbed.setColor(4289797)
        //         break;
        //     case "epic":
        //         cardEmbed.setColor(15140128)
        //         break;
        //     default:
        //         cardEmbed.setColor(13220907)
        // }
        // cardEmbed.setImage(cardData.fileName)
        // cardEmbed.setTimestamp()

        return cardEmbed
    }

}

module.exports = BazaarFormatter