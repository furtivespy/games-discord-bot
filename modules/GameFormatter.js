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

    static playerSecretHand(gameData, player){
        
        const newEmbed = new Discord.MessageEmbed()
            .setColor(13502711)
            .setTitle(`Your Current Information`)
            .setDescription(`**Current Game:** ${gameData.name}\n`)

        if (player.hands.main.length > 0){
            let cardList = ""
            this.cardSort(player.hands.main).forEach(card => {
                if (card.url){
                    cardList += `• ${this.cardLongName(card)} [image](${card.url})\n`
                } else {
                    cardList += `• ${this.cardLongName(card)}\n`
                }
                
                
            })
            newEmbed.addField("Cards in Hand", cardList)
        }
        return newEmbed
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

    static deckStatus(deckData){
        const newEmbed = new Discord.MessageEmbed()
            .setColor(13502711)
            .setTitle(`${deckData.name} deck`)
            .setDescription(`*started with ${deckData.allCards.length} cards*\nShuffle style: ${deckData.shuffleStyle}`)

        for (const pile in deckData.piles){
            newEmbed.addField(`${pile} pile`, `${deckData.piles[pile].cards.length} cards`, true)
        }
        
        return newEmbed
    }

    static cardSort(cardArry){
        return sortBy(cardArry, ['suit', 'value', 'name'])
    }

    static cardShortName(cardObj){
        let cardStr = cardObj.name
        if (cardObj.type.length > 0) { 
            switch (cardObj.format){
                case "B":
                    cardStr = `${cardObj.type}: ${cardStr}`
                    break;
                default:
                    cardStr += ` of ${cardObj.type}`
                    break;
            }
        }
        return cardStr
    }

    static cardLongName(cardObj){
        let cardStr = this.cardShortName(cardObj)
        if (cardObj.description.length > 0) {
            cardStr += ` (${cardObj.description})`
        }
        return cardStr
    }

    static oneCard(cardObj){
        let cardStr = this.cardShortName(cardObj)

        const newEmbed = new Discord.MessageEmbed()
            .setColor(13502711)
            .setTitle(cardStr)

        if (cardObj.description.length > 0) { newEmbed.setDescription(cardObj.description) }
        
        if (cardObj.url) { newEmbed.setImage(cardObj.url) }

        return newEmbed        
    }

    static handEmbed(playerData, guildName, channelName) {
        const cardsEmbed = new Discord.MessageEmbed().setColor(13928716).setTitle(`All cards in hand in #${channelName} at ${guildName}`).setTimestamp()
        playerData.hands.forEach(element => {
            if (element.cards.length > 0) {
                cardsEmbed.addField(`From ${element.deck} deck`, element.cards.sort().join("\n"))                
            } else {
                cardsEmbed.addField(`From ${element.deck} deck`, "No cards")    
            }

        }); 
        return cardsEmbed
    }

    static CountCards(player){
        let cards = 0
        if(!player) return 0
        return player.hands.main.length
    }
}

module.exports = GameFormatter