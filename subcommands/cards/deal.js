const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const Shuffle = require(`./shuffle`)

class Deal {
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
            if (gameData.isdeleted) {
                await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
                return
            }

            const inputDeck = interaction.options.getString('deck')
            const cardCount = interaction.options.getInteger('count')
            let dealCount = 0

            const deck = gameData.decks.length == 1 ? gameData.decks[0] : find(gameData.decks, {name: inputDeck})
            if (!deck || deck.piles.draw.cards.length + deck.piles.discard.cards.length < 1){
                await interaction.reply({ content: `No cards to deal.`, ephemeral: true })
                return
            } 
            
            dealLoop:
            for (let i = 0; i < cardCount; i++) {
                for (const player of gameData.players) {
                    if (deck.piles.draw.length < 1){
                        await Shuffle.execute(interaction, client)
                    } 

                    if (deck.piles.draw.cards.length + deck.piles.discard.cards.length < 1){
                        break dealLoop
                    }
                    const theCard = deck.piles.draw.cards.shift()
                    player.hands.main.push(theCard)
                    dealCount++
                }
            }

            client.setGameData(`game-${interaction.channel.id}`, gameData)

            const data = await Formatter.GameStatusV2(gameData, interaction.guild)

            await interaction.reply({ 
                content: `Dealt out a total of ${dealCount} cards from ${deck.name}.`,
                embeds: [
                    Formatter.deckStatus(deck)
                ],
                files: [...data]
            })
        }
    }
}


module.exports = new Deal()