const GameHelper = require('../../modules/GlobalGameHelper')
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
