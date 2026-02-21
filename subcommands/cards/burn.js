const GameHelper = require('../../modules/GlobalGameHelper');
const GameDB = require('../../db/anygame.js');
// No Formatter needed as we are not displaying card details

class Burn {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true);
            let gameData = await GameHelper.getGameData(client, interaction);
            
            if (focusedOption.name === 'deck') {
                await GameHelper.getDeckAutocomplete(gameData, interaction);
            } else if (focusedOption.name === 'pilename') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedOption.value));
            }
            return;
        }

        await interaction.deferReply();

        let gameData = await GameHelper.getGameData(client, interaction);

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`});
            return;
        }

        const inputDeck = interaction.options.getString('deck');
        const destination = interaction.options.getString('destination') || 'discard';
        const pileId = interaction.options.getString('pilename');
        
        const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id);

        if (!deck) {
            await interaction.editReply({ content: "Specified deck not found or no default deck available."});
            return;
        }

        if (!deck.piles || !deck.piles.draw || deck.piles.draw.cards.length < 1) {
            await interaction.editReply({ content: `The draw pile for ${deck.name} is empty.`});
            return;
        }

        const countToBurn = interaction.options.getInteger('count');

        if (countToBurn <= 0) {
            await interaction.editReply({ content: "Number of cards to burn must be greater than 0."});
            return;
        }

        // Validate destination pile if needed
        let targetPile = null;
        let destinationName = '';
        
        if (destination === 'pile') {
            targetPile = GameHelper.getGlobalPile(gameData, pileId);
            if (!targetPile) {
                await interaction.editReply({ content: 'Pile not found!'});
                return;
            }
            destinationName = targetPile.name;
        } else if (destination === 'gameboard') {
            if (!gameData.gameBoard) {
                gameData.gameBoard = [];
            }
            destinationName = 'Game Board';
        } else {
            destinationName = `${deck.name} discard pile`;
        }

        let actualBurnedCount = 0;
        for (let i = 0; i < countToBurn; i++) {
            if (deck.piles.draw.cards.length > 0) {
                const cardToBurn = deck.piles.draw.cards.shift();
                
                // Send to appropriate destination
                if (destination === 'pile') {
                    targetPile.cards.push(cardToBurn);
                } else if (destination === 'gameboard') {
                    gameData.gameBoard.push(cardToBurn);
                } else {
                    if (!deck.piles.discard) {
                        deck.piles.discard = { cards: [], viewable: true };
                    }
                    deck.piles.discard.cards.push(cardToBurn);
                }
                actualBurnedCount++;
            } else {
                break;
            }
        }

        if (actualBurnedCount === 0) {
            await interaction.editReply({ content: `No cards were burned. The draw pile for ${deck.name} might be empty.`});
            return;
        }

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.BURN,
                `${actorDisplayName} burned ${actualBurnedCount} cards from ${deck.name} to ${destinationName}`,
                {
                    deckName: deck.name,
                    cardCount: actualBurnedCount,
                    requestedCount: countToBurn,
                    source: "draw pile",
                    destination: destinationName,
                    destinationType: destination
                }
            )
        } catch (error) {
            console.warn('Failed to record card burn in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

        let replyMessage = `Burned ${actualBurnedCount} card(s) from the top of ${deck.name} to ${destinationName}.`;
        if (actualBurnedCount < countToBurn) {
            replyMessage += ` (Requested ${countToBurn}, but only ${actualBurnedCount} were available in the draw pile.)`;
        }

        await interaction.editReply({
            content: replyMessage
        });
    }
}

module.exports = new Burn();
