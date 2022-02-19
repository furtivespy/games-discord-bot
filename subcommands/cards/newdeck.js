const GameDB = require('../../db/anygame.js')
const { cloneDeep } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class NewDeck {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            client.getGameData(`game-${interaction.channel.id}`)
        )

        const inputName = interaction.options.getString('name')
        const inputSet = interaction.options.getString('cardset')
        const inputCustom = interaction.options.getString('customlist')
/*
        if (gameData.decks.)





        if (!args[0] || !args[1]) {
            const cardsEmbed = new Discord.MessageEmbed().setColor(13928716).setTitle("Add Deck for Use in Channel").setTimestamp()
            let deckList = ""
            for (let i = 0; i < CardDB.deckList.length; i++) {
                deckList += `**${CardDB.deckList[i].name}** - ${CardDB.deckList[i].description}\n`
            }
            cardsEmbed.addField(`Avaialble Decks`, deckList)
            cardsEmbed.addField(`Instructions`, `To add a deck use command in form of &cards new local-name deck_name
            e.g. \`&cards new MyDeck playing_cards\``)

            await message.channel.send({embeds: [cardsEmbed]})

        } else {
            let newName = args.shift()
            if (CardDB[args[0]]) {
                if (_.find(gameData.decks, {'name': newName})) {
                    await message.reply(`A deck named ${newName} already exists in this channel`)
                } else {
                    gameData.decks.push({name: newName, allCards: [...CardDB[args[0]]], currentDeck: [...CardDB[args[0]]], discard: []})
                    
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                    await message.reply(`added ${newName} to this channels cards. Remember to shuffle!`)
                }
            } else {
                let newDeck = _.split(args.join(" "), `,`)
                if (newDeck.length > 1) {
                    gameData.decks.push({name: newName, allCards: [...newDeck], currentDeck: [...newDeck], discard: []})
                    this.client.setGameData(`cards-${message.channel.id}`, gameData)
                    await message.reply(`added ${newName} to this channels cards. Remember to shuffle!`)
                }
            }
        }

*/








        await interaction.reply({ content: "Not Ready Yet!?!?!?", ephemeral: true })
        /*
        if (gameData.isdeleted) {
            //await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
        } else {
            
            
        }
        */
    }
}


module.exports = new NewDeck()