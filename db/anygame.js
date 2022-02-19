const Discord = require('discord.js')

const playingCards = ["A♣","K♣","Q♣","J♣","2♣","3♣","4♣","5♣","6♣","7♣","8♣","9♣","10♣","A♦","K♦","Q♦","J♦","2♦","3♦","4♦","5♦","6♦","7♦","8♦","9♦","10♦","A♥","K♥","Q♥","J♥","2♥","3♥","4♥","5♥","6♥","7♥","8♥","9♥","10♥","A♠","K♠","Q♠","J♠","2♠","3♠","4♠","5♠","6♠","7♠","8♠","9♠","10♠"]
const pairCards = [":one:",":two:",":two:",":three:",":three:",":three:",":four:",":four:",":four:",":four:",":five:",":five:",":five:",":five:",":five:",":six:",":six:",":six:",":six:",":six:",":six:",":seven:",":seven:",":seven:",":seven:",":seven:",":seven:",":seven:",":eight:",":eight:",":eight:",":eight:",":eight:",":eight:",":eight:",":eight:",":nine:",":nine:",":nine:",":nine:",":nine:",":nine:",":nine:",":nine:",":nine:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:"]

class GameDatabase {
    
    defaultGameData = {
        decks: [],
        players: [],
        name: "",
        isdeleted: true,
        winner: null
    }
    
    defaultSecretData = {
        isrevealed: true,
        players: []
    }

    defaultDeck = {
        name: "",
        allCards: [],
        piles: {
            draw: [],
            discard: [],
        }
    }
    
    defaultPlayer = {
        guildId: "1",
        userId: "1",
        order: 1,
        score: "",
        name: null,
        hands: [],
        color: null
    }
    
    defaultHand = {
        deck: "",
        cards: [],
    }

    handEmbed(playerData, guildName, channelName) {
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

}



module.exports = new GameDatabase();