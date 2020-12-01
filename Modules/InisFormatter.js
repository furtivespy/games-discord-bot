const Discord = require('discord.js')
const _ = require('lodash')
const Fuse = require('fuse.js')
const allCards = require('../db/cards.js')
const fuseSearch = new Fuse([...allCards.seasons, ...allCards.epics, ...allCards.lands], { keys: ['name']})


class InisFormatter {
    static async gameStatus(client, gameData){
        var guild = await client.guilds.fetch(gameData.players.find(p => p.isBrenn).guildId)

        const statusEmbed = new Discord.MessageEmbed().setColor(386945).setTitle("Current Game Status").setTimestamp()

        await Promise.all(_.orderBy(gameData.players, 'order').map(async (player) => {
            var user = await guild.members.fetch(player.userId)
            statusEmbed.addField(`${(player.isBrenn) ? ":crown: " : ""}${user.displayName}`, `${player.hand.length} card${(player.hand.length==1) ? "" : "s"}`)
        }))
        statusEmbed.addField('Flock of Crows', `${(gameData.isClockwise) ? ":arrows_clockwise:" : ":arrows_counterclockwise:"} ${gameData.order}`)

        return statusEmbed
    }

    static createCardEmbed(cardData, title){
        const cardEmbed = new Discord.MessageEmbed().setTitle(cardData.name).setDescription(cardData.text).setAuthor(title)
        switch (cardData.type) {
            case "season":
                cardEmbed.setColor(4289797)
                break;
            case "epic":
                cardEmbed.setColor(15140128)
                break;
            default:
                cardEmbed.setColor(13220907)
        }
        cardEmbed.setImage(cardData.fileName)
        cardEmbed.setTimestamp()

        return cardEmbed
    }

    static findCard(cardName){
        var searchResults = fuseSearch.search(cardName)
        if (searchResults && searchResults[0]) {
            return this.createCardEmbed(searchResults[0].item, "Search Result")
        }
        return undefined
    }
}

module.exports = InisFormatter