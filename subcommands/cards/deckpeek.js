const GameDB = require('../../db/anygame.js')

module.exports = {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
        } else {
            try {
                await interaction.deferReply({ ephemeral: true })

                const deckName = interaction.options.getString('deck');
                let depth = interaction.options.getInteger('depth') ?? 1;
                if (!deckName) {
                    await interaction.editReply({ content: 'You must specify a deck to peek at.', ephemeral: true });
                    return;
                }
                if (depth < 1) {
                    await interaction.editReply({ content: 'Depth must be at least 1.', ephemeral: true });
                    return;
                }
                // Fetch the deck from the DB
                const deckData = await GameDB.getDeck(interaction.channelId, deckName);
                if (!deckData || !Array.isArray(deckData.cards) || deckData.cards.length === 0) {
                    await interaction.editReply({ content: `Deck "${deckName}" is empty or not set up correctly.`, ephemeral: true });
                    return;
                }
                if (depth > deckData.cards.length) {
                    await interaction.editReply({ content: `Deck "${deckName}" only has ${deckData.cards.length} card(s). Cannot peek at position ${depth}.`, ephemeral: true });
                    return;
                }
                const theCard = deckData.cards[depth - 1];

                await interaction.editReply(
                    await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id,
                        { 
                            content: `${interaction.member.displayName} peeked at a card from deck ${deck.name} at depth ${depth}`,
                            ephemeral: false
                        }
                    )
                );
                await interaction.followUp({ 
                    content: `You peeked and saw:`, 
                    embeds: [Formatter.oneCard(theCard)],
                    ephemeral: true
                })
            } catch (e) {
                if (interaction && interaction.reply) {
                    await interaction.reply({ content: 'An error occurred while peeking at the deck.', ephemeral: true });
                }
                if (client && client.logger) {
                    client.logger.log(e, 'error');
                }
            }
        }
    }
};
