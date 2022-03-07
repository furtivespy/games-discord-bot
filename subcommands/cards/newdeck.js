const GameDB = require('../../db/anygame.js')
const { cloneDeep, find, shuffle } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class NewDeck {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            client.getGameData(`game-${interaction.channel.id}`)
        )

        if (gameData.isdeleted){
            await interaction.reply(
                { content: `Please use "/game newgame" command to create a game. I need a game in this channel to attach the deck to.`, 
                  ephemeral: true })
            return
        }

        const inputName = interaction.options.getString('name')
        const inputSet = interaction.options.getString('cardset')
        const inputCustom = interaction.options.getString('customlist')

        if (find(gameData.decks, {'name': inputName})) {
            await interaction.reply({ content: `There is already a deck with that name...`, ephemeral: true })
            return
        } 
        if (inputSet == 'custom' && (!inputCustom || inputCustom.length == 0)) {
            await interaction.reply({ content: `When choosing a custom deck, please include the "customlist" of cards`, ephemeral: true })
            return
        }

        let newdeck = Object.assign(
            {},
            cloneDeep(GameDB.defaultDeck),
            {name: inputName}
        )

        if (inputSet != 'custom' && inputSet != 'customempty'){
            newdeck.allCards = GameDB.MakeSpecificDeck(inputName, inputSet)
        } else {
            await interaction.reply({ content: `Custom decks are not ready yet...`, ephemeral: true })
            return
        }

        newdeck.piles.draw.cards = cloneDeep(shuffle(newdeck.allCards))
        gameData.decks.push(newdeck)

        client.setGameData(`game-${interaction.channel.id}`, gameData)
        let deckEmbeds = []
        gameData.decks.forEach(deck => {
            deckEmbeds.push(Formatter.deckStatus(deck))
        })

        await interaction.reply({ 
            content: `Added and shuffled the new deck: ${inputName}`,
            embeds: [
                await Formatter.GameStatus(gameData, interaction.guild),
                ...deckEmbeds
            ]
        })

    }
}


module.exports = new NewDeck()