const GameHelper = require('../../modules/GlobalGameHelper');
const GameDB = require('../../db/anygame.js');
const { find, cloneDeep } = require('lodash');

module.exports = {
    name: "playareaclearall",
    async execute(interaction, client) {
        try {
            const gameData = await GameHelper.getGameData(client, interaction);

            if (!gameData || gameData.isdeleted) {
                await interaction.reply({ content: "There is no game active in this channel, or the game data is unavailable.", ephemeral: true });
                return;
            }

            if (!gameData.players || gameData.players.length === 0) {
                await interaction.reply({ content: "There are no players in the game to clear play areas for.", ephemeral: true });
                return;
            }

            let cardsMovedCount = 0;
            const updatedGameData = cloneDeep(gameData);

            for (const player of updatedGameData.players) {
                if (player.playArea && player.playArea.length > 0) {
                    const cardsToMove = [...player.playArea]; // Iterate over a copy
                    for (const card of cardsToMove) {
                        const deck = find(updatedGameData.decks, { name: card.origin });
                        if (deck) {
                            if (!deck.piles.discard) {
                                deck.piles.discard = { cards: [], viewable: true }; // Should exist based on defaultDeck, but good practice
                            }
                            deck.piles.discard.cards.push(card);
                            // Remove card from playArea by id
                            const cardIndex = player.playArea.findIndex(c => c.id === card.id);
                            if (cardIndex > -1) {
                                player.playArea.splice(cardIndex, 1);
                                cardsMovedCount++;
                            }
                        } else {
                            // This case should ideally not happen if card.origin is always valid
                            console.warn(`Could not find origin deck "${card.origin}" for card "${card.name}" in player ${player.userId}'s play area.`);
                            // Decide if we want to notify user or just log
                        }
                    }
                }
            }

            if (cardsMovedCount === 0) {
                await interaction.reply({ content: "All player play areas were already empty. No cards were moved.", ephemeral: false });
                return;
            }

            // Record history
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                
                GameHelper.recordMove(
                    updatedGameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.CARD,
                    GameDB.ACTION_TYPES.DISCARD,
                    `${actorDisplayName} cleared all play areas (${cardsMovedCount} cards to discard piles)`,
                    {
                        cardCount: cardsMovedCount,
                        playerCount: updatedGameData.players.filter(p => p.playArea && p.playArea.length > 0).length,
                        action: "clearall"
                    }
                )
            } catch (error) {
                console.warn('Failed to record play area clear all in history:', error)
            }

            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, updatedGameData);
            await interaction.reply({ content: `Successfully moved ${cardsMovedCount} card(s) from all player play areas to their respective discard pile(s).`, ephemeral: false });

        } catch (e) {
            console.error("Error in /cards playarea clearall:", e);
            await interaction.reply({ content: "An error occurred while trying to clear all play areas. Please try again later.", ephemeral: true });
        }
    }
};
