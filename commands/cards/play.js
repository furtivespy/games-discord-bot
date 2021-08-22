const Command = require('../../base/Command.js')
const CardDB = require('../../db/carddecks.js')
const CardHelp = require('../../modules/CardsAssistant.js')
const Discord = require('discord.js')
const _ = require('lodash')

class Play extends Command {
    constructor(client){
        super(client, {
            name: "cards-play",
            description: "Card deck play card",
            category: "Cards",
            usage: "use this command to play a card from a deck (is then discarded)",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["card-play", "cplay"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            let gameData = Object.assign({}, _.cloneDeep(CardDB.defaultGameData), this.client.getGameData(`cards-${message.channel.id}`))
            let activePlayer = _.find(gameData.players, {userId: message.author.id})
            if (Play.CountCards(activePlayer) == 0){
                message.reply(`You have no cards in hand`)
                return
            }
            let hand = await CardHelp.ChooseDeck(activePlayer, message, "Play")
            if (hand) {
                let card = await CardHelp.ChooseCard(activePlayer, hand, message, "Play")
                if (card){
                    Play.DoDiscard(gameData, hand, card)
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                    await message.reply(`has played ${card}`)
                    this.client.TryExecuteCommand("cards-hand", message, [])
                }
            }
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

    static CountCards(player){
        let cards = 0
        if(!player) return 0
        player.hands.forEach(hand => {
            cards += hand.cards.length
        });
        return cards
    }

    static DoDiscard(gameData, hand, card){
        hand.cards.splice(hand.cards.indexOf(card),1)
        let deck = _.find(gameData.decks, { name: hand.deck })
        deck.discard.push(card)
    }

}

module.exports = Play