const GameHelper = require('../../modules/GlobalGameHelper')
const { find, remove, cloneDeep, shuffle } = require('lodash')
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
        deck.piles.draw.cards = cloneDeep(shuffle(deck.allCards))

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        await interaction.editReply(
            await Formatter.createGameStatusReply(gameData, interaction.guild,
              { content: `All cards recalled to ${deck.name}` }
            )
          );
    }
}

module.exports = new Recall()
