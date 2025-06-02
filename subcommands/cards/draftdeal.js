const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const Shuffle = require(`./shuffle`)

class Deal {
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
        const cardCount = interaction.options.getInteger('count')
        let dealCount = 0

        const deck = gameData.decks.length == 1 ? gameData.decks[0] : find(gameData.decks, {name: inputDeck})
        if (!deck || deck.piles.draw.cards.length + deck.piles.discard.cards.length < 1){
            await interaction.editReply({ content: `No cards to deal.`, ephemeral: true })
            return
        } 
        
        dealLoop:
        for (let i = 0; i < cardCount; i++) {
            for (let j = 0; j < gameData.players.length; j++) {
                const player = gameData.players[j]
                if (deck.piles.draw.cards.length < 1){
                    await Shuffle.execute(interaction, client)
                } 

                if (deck.piles.draw.cards.length + deck.piles.discard.cards.length < 1){
                    break dealLoop
                }
                const theCard = deck.piles.draw.cards.shift()
                if (i==0) { player.hands.draft = [] }
                player.hands.draft.push(theCard)
                dealCount++
            }
        }

        //client.setGameData(`game-${interaction.channel.id}`, gameData)
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await interaction.editReply(
            await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id,
              { content: `Dealt out a total of ${dealCount} cards.` }
            )
          );
    }
}

module.exports = new Deal()