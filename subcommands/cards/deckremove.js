const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find, remove } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class DeckRemove {
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

        if (interaction.options.getString('confirm') !== 'delete') {
            await interaction.reply({ content: `Deck not deleted. You must confirm by typing 'delete' in the confirm option.`, ephemeral: true })
            return
        }

        await interaction.deferReply()

        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const inputDeck = interaction.options.getString('deckname')
        const deck = find(gameData.decks, {name: inputDeck})
        if (!deck){
            await interaction.editReply({ content: `Could not find a deck named "${inputDeck}".`, ephemeral: true })
            return
        }

        // Recall logic first
        const removeCardsFromLocation = (locationArray) => {
            if (Array.isArray(locationArray)) {
                remove(locationArray, card => card.origin === deck.name);
            }
        };

        gameData.players.forEach(player => {
            if (player.hands) {
                removeCardsFromLocation(player.hands.main);
                removeCardsFromLocation(player.hands.draft);
                removeCardsFromLocation(player.hands.played);
                removeCardsFromLocation(player.hands.passed);
                removeCardsFromLocation(player.hands.received);
                removeCardsFromLocation(player.hands.simultaneous);
            }

            if (player.playArea) {
                removeCardsFromLocation(player.playArea);
            }
        });

        const deckName = deck.name;
        // Now remove the deck
        remove(gameData.decks, {name: deck.name});

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username

            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.DELETE,
                `${actorDisplayName} removed the deck "${deckName}" from the game.`,
                {
                    deckName: deckName,
                    action: "deck remove"
                }
            )
        } catch (error) {
            console.warn('Failed to record deck removal in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        await GameStatusHelper.sendGameStatus(interaction, client, gameData,
          { content: `Deck "${deckName}" has been removed.` }
        );
    }
}

module.exports = new DeckRemove()