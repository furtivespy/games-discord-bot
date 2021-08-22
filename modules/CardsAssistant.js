const Discord = require('discord.js')
const _ = require('lodash')
const Emoji = require('./EmojiAssitant.js')
const Logger = require('./Logger.js')

class CardsAssistant {
    static async ChooseDeck(player, message, actionName){
        if (player.hands.length == 0) return player.hands[0]
        const handEmbed = new Discord.MessageEmbed().setColor(13928716).setTitle(`Select a Deck To ${actionName} From`)
        let decks = ""
        for (let i = 0; i < player.hands.length && i < 10; i++) {
            decks += `${Emoji.IndexToEmoji(i)}:arrow_right:  ${player.hands[i].deck}\n`
        }
        handEmbed.setDescription(decks)
        let msg = await message.author.send(handEmbed)
        CardsAssistant.AddReactions(player.hands.length, msg)
        
        try {
            var deckReaction = await msg.awaitReactions((reaction, user) => user.id == player.userId 
                && (reaction.emoji.name == '1️⃣' || reaction.emoji.name == '2️⃣' || reaction.emoji.name == '3️⃣' || reaction.emoji.name == '4️⃣' || reaction.emoji.name == '5️⃣'
                 || reaction.emoji.name == '6️⃣' || reaction.emoji.name == '7️⃣' || reaction.emoji.name == '8️⃣' || reaction.emoji.name == '9️⃣' || reaction.emoji.name == '🔟'),
                { max: 1, time: 60000 })
        } catch {
            deckReaction = {}
        }

        if (!deckReaction.first()){
            await msg.edit(`No reaction after 60 seconds, ${actionName} canceled - try again when ready`);
            await msg.suppressEmbeds(true)
            return undefined
        }
        return player.hands[Emoji.EmojiToIndex(deckReaction.first().emoji.name)]
    }

    static async ChooseCard(player, hand, message, actionName, page=0){
        const handEmbed = new Discord.MessageEmbed().setColor(13928716).setTitle(`Select a Card To ${actionName} from ${hand.deck}`)
        let cards = ""
        if (page > 0){
            cards += `⏮️:arrow_right: (Previous Page)\n` 
        }
        for (let i = 0; (i + (page*10)) < hand.cards.length && i < 10; i++) {
            cards += `${Emoji.IndexToEmoji(i)}:arrow_right:  ${hand.cards[i + (page*10)]}\n`
        }
        if (hand.cards.length > ((page+1)*10)) {
            cards += `⏭️:arrow_right: (Next Page)\n` 
        }
        handEmbed.setDescription(cards)
        let msg = await message.author.send(handEmbed)
        if (page > 0){
            await msg.react("⏮️")
        }
        await CardsAssistant.AddReactions(hand.cards.length - (page*10), msg)
        if (hand.cards.length > ((page+1)*10)) {
            await msg.react("⏭️") 
        }
        try {
            var deckReaction = await msg.awaitReactions((reaction, user) => user.id == player.userId 
                && (reaction.emoji.name == '1️⃣' || reaction.emoji.name == '2️⃣' || reaction.emoji.name == '3️⃣' || reaction.emoji.name == '4️⃣' || reaction.emoji.name == '5️⃣'
                 || reaction.emoji.name == '6️⃣' || reaction.emoji.name == '7️⃣' || reaction.emoji.name == '8️⃣' || reaction.emoji.name == '9️⃣' || reaction.emoji.name == '🔟')
                 || reaction.emoji.name == '⏭️' || reaction.emoji.name == '⏮️',
                { max: 1, time: 60000 })
        } catch {
            deckReaction = {}
        }

        if (!deckReaction.first()){
            await msg.edit(`No reaction after 60 seconds, ${actionName} canceled - try again when ready`);
            await msg.suppressEmbeds(true)
            return undefined
        }
        if (deckReaction.first().emoji.name == "⏭️"){
            return await CardsAssistant.ChooseCard(player, hand, message, actionName, page+1)
        } else if (deckReaction.first().emoji.name == "⏮️") {
            return await CardsAssistant.ChooseCard(player, hand, message, actionName, page-1)
        }

        return hand.cards[Emoji.EmojiToIndex(deckReaction.first().emoji.name) + (page*10)]
    }

    static async AddReactions(len, msg){
        for (let i = 0; i < len && i < 10; i++) {
            await msg.react(Emoji.IndexToEmoji(i))
        }
    }


}

module.exports = CardsAssistant