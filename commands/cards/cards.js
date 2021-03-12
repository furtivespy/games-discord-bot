const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const _ = require('lodash')

class Cards extends Command {
    constructor(client){
        super(client, {
            name: "cards",
            description: "Card Game Status",
            category: "Cards",
            usage: "use this command to get current deck status",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["card", "c"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            if (args[0]) {
                const newCmd = args.shift()
                this.client.TryExecuteCommand("cards-" + newCmd.toLowerCase(), message, args)
            } else {
                let gameData = this.client.getGameData(`cards-${message.channel.id}`)
                if (gameData.decks && gameData.decks.length > 0) {

                    const cardsEmbed = new Discord.MessageEmbed().setColor(13928716).setTitle("Current Decks In This Channel").setTimestamp()
                    for(let i=0; i<gameData.decks.length;i++){
                        cardsEmbed.addField(gameData.decks[i].name, `${gameData.decks[i].currentDeck.length} cards remaining (${gameData.decks[i].discard.length} discards)`)
                    }

                    await message.channel.send(cardsEmbed);
                } else {
                    this.client.TryExecuteCommand("cards-help", message, args)
                }                
                
            }
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

}

module.exports = Cards