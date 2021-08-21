const Command = require('../../base/Command.js')
const CardDB = require('../../db/carddecks.js')
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
            let hand = await this.ChooseDeck(activePlayer, message)
            if (hand) {
                let card = await this.ChooseCard(activePlayer, hand, message)
                Play.DoDiscard(gameData, hand, card)
                this.client.setGameData(`cards-${message.channel.id}`, gameData)
                await message.reply(`has played ${card}`)
                this.client.TryExecuteCommand("cards-hand", message, [])
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

    async ChooseDeck(player, message){
        if (player.hands.length == 0) return player.hands[0]
        const handEmbed = new Discord.MessageEmbed().setColor(13928716).setTitle(`Select a Deck To Play From`)
        let decks = ""
        for (let i = 0; i < player.hands.length && i < 10; i++) {
            decks += `${super.indexToEmoji(i)}:arrow_right:  ${player.hands[i].deck}\n`
        }
        handEmbed.setDescription(decks)
        let msg = await message.author.send(handEmbed)
        this.AddReactions(player.hands.length, msg)
        
        try {
            var deckReaction = await msg.awaitReactions((reaction, user) => user.id == player.userId 
                && (reaction.emoji.name == '1️⃣' || reaction.emoji.name == '2️⃣' || reaction.emoji.name == '3️⃣' || reaction.emoji.name == '4️⃣' || reaction.emoji.name == '5️⃣'
                 || reaction.emoji.name == '6️⃣' || reaction.emoji.name == '7️⃣' || reaction.emoji.name == '8️⃣' || reaction.emoji.name == '9️⃣' || reaction.emoji.name == '🔟'),
                { max: 1, time: 60000 })
        } catch {
            deckReaction = {}
        }

        if (!deckReaction.first()){
            await msg.edit('No reaction after 60 seconds, play canceled - try again when ready');
            await msg.suppressEmbeds(true)
            return undefined
        }
        return player.hands[super.emojiToIndex(deckReaction.first().emoji.name)]
    }

    async ChooseCard(player, hand, message, startIndex = 0){
        const handEmbed = new Discord.MessageEmbed().setColor(13928716).setTitle(`Select a Card To Play from ${hand.deck}`)
        let cards = ""
        for (let i = 0; i < hand.cards.length && i < 10; i++) {
            cards += `${super.indexToEmoji(i)}:arrow_right:  ${hand.cards[i]}\n`
        }
        handEmbed.setDescription(cards)
        let msg = await message.author.send(handEmbed)
        this.AddReactions(hand.cards.length, msg)
        
        try {
            var deckReaction = await msg.awaitReactions((reaction, user) => user.id == player.userId 
                && (reaction.emoji.name == '1️⃣' || reaction.emoji.name == '2️⃣' || reaction.emoji.name == '3️⃣' || reaction.emoji.name == '4️⃣' || reaction.emoji.name == '5️⃣'
                 || reaction.emoji.name == '6️⃣' || reaction.emoji.name == '7️⃣' || reaction.emoji.name == '8️⃣' || reaction.emoji.name == '9️⃣' || reaction.emoji.name == '🔟'),
                { max: 1, time: 60000 })
        } catch {
            deckReaction = {}
        }

        if (!deckReaction.first()){
            await msg.edit('No reaction after 60 seconds, play canceled - try again when ready');
            await msg.suppressEmbeds(true)
            return undefined
        }
        return hand.cards[super.emojiToIndex(deckReaction.first().emoji.name)]
    }

    async AddReactions(len, msg){
        for (let i = 0; i < len && i < 10; i++) {
            await msg.react(super.indexToEmoji(i))
        }
    }
}

module.exports = Play