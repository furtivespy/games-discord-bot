const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Flip {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            await client.getGameData(`game-${interaction.channel.id}`)
        )

        if (interaction.isAutocomplete()) {
            if (gameData.isdeleted || gameData.decks.length < 1){
                await interaction.respond([])
                return
            }
            await interaction.respond(gameData.decks.map(d => ({name: d.name, value: d.name})))
        } else {
            const inputDeck = interaction.options.getString('deck')
            const deck = gameData.decks.length == 1 ? gameData.decks[0] : find(gameData.decks, {name: inputDeck})

            if (!deck || deck.piles.draw.cards.length < 0){
                await interaction.reply({ content: "No cards in draw pile", ephemeral: true })
                return
            } 

            const theCard = deck.piles.draw.cards.shift()
            deck.piles.discard.cards.push(theCard)
            client.setGameData(`game-${interaction.channel.id}`, gameData)

            await interaction.reply({ 
                content: `Flipped from the top of ${deck.name}`, 
                embeds: [Formatter.oneCard(theCard)]
            })
        }
    }
}


module.exports = new Flip()