const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const Formatter = require('../../modules/GameFormatter')

module.exports = {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
        } else {
            try {
                await interaction.deferReply()

                let gameData = await GameHelper.getGameData(client, interaction);
                const deckName = interaction.options.getString('deck');
                let depth = interaction.options.getInteger('depth') ?? 1;
                // Fetch the deck from the DB
                const deckData = GameHelper.getSpecificDeck(gameData, deckName, interaction.user.id);
                if (!deckData) {
                    await interaction.editReply({ content: `Deck "${deckName}" is empty or not set up correctly.`, ephemeral: true });
                    return;
                }

                const cardsArray = deckData.piles.draw.cards;
                if(!Array.isArray(cardsArray) || cardsArray.length === 0) {
                    await interaction.editReply({ content: `Deck "${deckName}" is empty or not set up correctly.`, ephemeral: true });
                    return;
                }
                if (depth < 1 || depth > cardsArray.length) {
                    await interaction.editReply({ content: `Deck "${deckName}" has ${cardsArray.length} card(s). Cannot peek at position ${depth}.`, ephemeral: true });
                    return;
                }

                const theCard = cardsArray[depth - 1];

                // Record history for deck peek (strategically significant information)
                try {
                    const actorDisplayName = interaction.member?.displayName || interaction.user.username
                    
                    GameHelper.recordMove(
                        gameData,
                        interaction.user,
                        GameDB.ACTION_CATEGORIES.CARD,
                        GameDB.ACTION_TYPES.REVEAL,
                        `${actorDisplayName} peeked at card ${depth} in deck ${deckData.name}`,
                        {
                            deckName: deckData.name,
                            peekDepth: depth,
                            cardId: theCard.id,
                            cardName: Formatter.cardShortName(theCard), // For admin/debugging only
                            playerUserId: interaction.user.id,
                            playerUsername: actorDisplayName,
                            deckSize: cardsArray.length,
                            action: "deck peek at specific depth"
                        }
                    )
                } catch (error) {
                    console.warn('Failed to record deck peek in history:', error)
                }

                await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

                await interaction.editReply({ 
                    content: `${interaction.member.displayName} peeked at a card from deck ${deckData.name} at depth ${depth}`
                })
                await interaction.followUp({ 
                    content: `You peeked and saw:`, 
                    embeds: [Formatter.oneCard(theCard)],
                    ephemeral: true
                })
            } catch (e) {
                if (client && client.logger) {
                    client.logger.log(e, 'error');
                }
                if (interaction && interaction.editReply) {
                    await interaction.editReply({ content: 'An error occurred while peeking at the deck.', ephemeral: true });
                }
            }
        }
    }
};
