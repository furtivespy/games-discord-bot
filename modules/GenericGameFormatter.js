const Discord = require('discord.js')
const _ = require('lodash')
var AsciiTable = require('ascii-table')


class GameFormatter {
    static async GameStatus(gameData, message){
        const newEmbed = new Discord.MessageEmbed().setColor(13502711).setTitle(`Current Game Status`).setFooter("\u2800".repeat(60) + "🎲")

        var table = new AsciiTable(gameData.name ?? "Game Title")
        table.setHeading("Player", "Score", "Cards in Hand")
        gameData.players.forEach(play => {
            const cards = GameFormatter.CountCards(play)
            let name = ""
            if (message.guild.members.cache.get(play.userId)) {
                name = message.guild.members.cache.get(play.userId).displayName
            }
            table.addRow(name ?? play.userId, play.score, cards)
        });
        newEmbed.setDescription(`\`\`\`\n${table.toString()}\n\`\`\``)

        return newEmbed;
    }

    static CountCards(player){
        let cards = 0
        if(!player) return 0
        player.hands.forEach(hand => {
            cards += hand.cards.length
        });
        return cards
    }
}

module.exports = GameFormatter