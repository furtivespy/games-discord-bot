const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')
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
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        const inputDeck = interaction.options.getString('deck')
        const cardCount = interaction.options.getInteger('count')
        let dealCount = 0

        const deck = gameData.decks.length == 1 ? gameData.decks[0] : find(gameData.decks, {name: inputDeck})
        if (!deck || deck.piles.draw.cards.length + deck.piles.discard.cards.length < 1){
            await interaction.editReply({ content: `No cards to deal.`})
            return
        } 
        
        dealLoop:
        for (let i = 0; i < cardCount; i++) {
            for (let j = 0; j < gameData.players.length; j++) {
                const player = gameData.players[j]
                if (deck.piles.draw.cards.length < 1){
                    await Shuffle.execute(interaction, client, gameData, deck.name, true)
                } 

                if (deck.piles.draw.cards.length < 1){
                    break dealLoop
                }
                const theCard = deck.piles.draw.cards.shift()
                if (i==0) { player.hands.draft = [] }
                player.hands.draft.push(theCard)
                dealCount++
            }
        }

        // Record history for draft deal affecting all players
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const playerDrafts = []
            
            gameData.players.forEach(player => {
                const displayName = interaction.guild.members.cache.get(player.userId)?.displayName || player.name || player.userId
                playerDrafts.push({
                    userId: player.userId,
                    displayName: displayName,
                    draftHandSize: player.hands.draft?.length || 0
                })
            })
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.DEAL,
                `${actorDisplayName} dealt ${dealCount} cards for drafting (${cardCount} per player)`,
                {
                    deckName: deck.name,
                    cardsPerPlayer: cardCount,
                    totalCardsDealt: dealCount,
                    playersReceived: gameData.players.length,
                    playerDrafts: playerDrafts,
                    action: "draft deal to all players"
                }
            )
        } catch (error) {
            console.warn('Failed to record draft deal in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await GameStatusHelper.sendGameStatus(interaction, client, gameData,
          { content: `Dealt out a total of ${dealCount} cards.` }
        );
    }
}

module.exports = new Deal()