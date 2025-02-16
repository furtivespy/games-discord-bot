const GameHelper = require('../../modules/GlobalGameHelper')
const { find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Recall {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            if (gameData.isdeleted || gameData.decks.length < 1){
                await interaction.respond([])
                return
            }
            await interaction.respond(gameData.decks.map(d => ({name: d.name, value: d.name})))
            return
        }

        await interaction.deferReply()
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const inputDeck = interaction.options.getString('deck')
        const deck = gameData.decks.length == 1 ? gameData.decks[0] : find(gameData.decks, {name: inputDeck})
        if (!deck){
            await interaction.editReply({ content: `No Deck`, ephemeral: true })
            return
        } 

        gameData.players.forEach(player => {
            remove(player.hands.main, card => card.origin === deck.name)
            if (player.hands.draft){
                remove(player.hands.draft, card => card.origin === deck.name)
            }
        })

        deck.piles.discard.cards = []
        deck.piles.draw.cards = GameHelper.shuffle(deck.allCards)

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        const data = await Formatter.GameStatusV2(gameData, interaction.guild)
        await interaction.editReply({ 
            content: `All cards recalled to ${deck.name}`,
            embeds: [
                Formatter.deckStatus(deck)
            ],
            files: [...data]
        })
    }
}

module.exports = new Recall()
