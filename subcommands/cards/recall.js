const GameDB = require('../../db/anygame.js')
const { cloneDeep, shuffle, remove } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Recall {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            client.getGameData(`game-${interaction.channel.id}`)
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
            const deck = gameData.decks.length == 1 ? gameData.decks[0] : find(gameData.decks, {name: inputDeck})
            if (!deck){
                await interaction.reply({ content: `No Deck`, ephemeral: true })
                return
            } 

            gameData.players.forEach(player => {
                remove(player.hands.main, card => card.origin === deck.name)
                if (player.hands.draft){
                    remove(player.hands.draft, card => card.origin === deck.name)
                }
            })

            deck.piles.discard.cards = []
            deck.piles.draw.cards = cloneDeep(shuffle(deck.allCards))

            client.setGameData(`game-${interaction.channel.id}`, gameData)
            const data = await Formatter.GameStatusV2(gameData, interaction.guild)
            await interaction.reply({ 
                content: `All cards recalled to ${deck.name}`,
                embeds: [
                    Formatter.deckStatus(deck)
                ],
                files: [...data]
            })
        }
    }
}

module.exports = new Recall()
