const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
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
            // Helper function to safely remove cards by origin
            const removeCardsFromLocation = (locationArray) => {
                if (Array.isArray(locationArray)) {
                    remove(locationArray, card => card.origin === deck.name);
                }
            };

            if (player.hands) {
                removeCardsFromLocation(player.hands.main);
                removeCardsFromLocation(player.hands.draft);
                removeCardsFromLocation(player.hands.played);
                removeCardsFromLocation(player.hands.passed);
                removeCardsFromLocation(player.hands.received);
                removeCardsFromLocation(player.hands.simultaneous);
            }

            if (player.playArea) { // playArea is directly on player object
                removeCardsFromLocation(player.playArea);
            }
        });

        deck.piles.discard.cards = []
        deck.piles.draw.cards = cloneDeep(shuffle(deck.allCards))

        // Record history - major game state change affecting all players
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.RECALL,
                `${actorDisplayName} recalled all cards from ${deck.name} and reshuffled deck`,
                {
                    deckName: deck.name,
                    totalCards: deck.allCards.length,
                    action: "deck recall and reshuffle"
                }
            )
        } catch (error) {
            console.warn('Failed to record deck recall in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        await interaction.editReply(
            await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id,
              { content: `All cards recalled to ${deck.name}` }
            )
          );
    }
}

module.exports = new Recall()
