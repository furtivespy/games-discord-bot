const Discord = require('discord.js')
const Emoji = require('./EmojiAssitant')
const { sortBy } = require('lodash')
var AsciiTable = require('ascii-table')


class GameFormatter {
    static async GameStatus(gameData, guild){
        const newEmbed = new Discord.MessageEmbed()
            .setColor(13502711)
            .setTitle(`Current Game Status`)
            .setFooter({ text: "\u2800".repeat(60) + "🎲"})

        const table = new AsciiTable(gameData.name ?? "Game Title")
        if (gameData.decks.length > 0) { //With Cards
            let handName = "Cards in Hand"
            if (gameData.decks.length == 1) {
                handName = `${gameData.decks[0].name} Cards`
            }
            table.setHeading("Player", "Score", handName)
            sortBy(gameData.players, ['order']) .forEach(play => {
                const cards = GameFormatter.CountCards(play)
                const name = guild.members.cache.get(play.userId)?.displayName
                table.addRow(`${Emoji.IndexToEmoji(play.order)}${name ?? play.name ?? play.userId}`, play.score, cards)
            });
        } else { //No Cards
            table.setHeading("Player", "Score")
            sortBy(gameData.players, ['order']) .forEach(play => {
                const name2 = guild.members.cache.get(play.userId)?.displayName
                table.addRow(`${Emoji.IndexToEmoji(play.order)}${name2 ?? play.name ?? play.userId}`, play.score)
            });
        }

        newEmbed.setDescription(`\`\`\`\n${table.toString()}\n\`\`\``)

        return newEmbed;
    }

    static async GameWinner(gameData, guild){
        const winnerName = guild.members.cache.get(gameData.winner)?.displayName

        const newEmbed = new Discord.MessageEmbed()
            .setColor(0xfff200)
            .setTitle(`👑 Congratulations ${winnerName} 👑`)
            .setDescription(`For winning ${gameData.name}`)
            
        return newEmbed
    }

    static async SecretStatus(secretData, guild){
        const newEmbed = new Discord.MessageEmbed()
            .setColor(0x360280)
            .setTitle(`Secrets`)

        secretData.players.forEach(play => {
            const name = guild.members.cache.get(play.userId)?.displayName
            const scrt = secretData.isrevealed ? play.secret : (play.hassecret ? `*Secret hidden*` : `**No Secrets**`)
            newEmbed.addField(`${name ?? play.name ?? play.userId}`, scrt)            
        })
        
        return newEmbed
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