const GameHelper = require('../../modules/GlobalGameHelper');
const Formatter = require('../../modules/GameFormatter');
const { find, findIndex } = require('lodash');
const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js'); // For select menu

module.exports = {
    // data will be defined in the main cards.js and just routed here
    // Or, if we want options for this specific subcommand:
    // data: new SlashCommandSubcommandBuilder().setName('playareadiscard').setDescription('Discards a card from your play area.'),
    // For now, assuming it's routed directly and doesn't need its own data builder here.

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true }); // Start with ephemeral, can make non-ephemeral later if needed

        const gameData = await GameHelper.getGameData(client, interaction);
        if (gameData.isdeleted) {
            return interaction.editReply({ content: "No active game found in this channel.", ephemeral: true });
        }

        const player = find(gameData.players, { userId: interaction.user.id });
        if (!player) {
            return interaction.editReply({ content: "You don't seem to be a player in the current game.", ephemeral: true });
        }

        if (!player.playArea || player.playArea.length === 0) {
            return interaction.editReply({ content: "Your play area is currently empty.", ephemeral: true });
        }

        // Card Selection using StringSelectMenu
        const options = player.playArea.map((card, index) => ({
            label: Formatter.cardShortName(card).substring(0, 100), // Max 100 chars for label
            description: (card.description || `Card at position ${index + 1}`).substring(0, 100), // Max 100 chars for description
            value: card.id, // Use card ID as value
        }));

        if (options.length === 0) { // Should be caught by playArea.length check, but as a safeguard
            return interaction.editReply({ content: "No cards available in your play area to select.", ephemeral: true });
        }

        // Discord select menus can have max 25 options. Handle pagination if necessary.
        // For this version, we'll assume play areas are not excessively large or truncate.
        // A more robust solution for >25 cards would involve multiple messages or pages.
        if (options.length > 25) {
            await interaction.editReply({ content: "You have too many cards in your play area to display in a single list for now. This feature currently supports up to 25 cards in the play area for selection.", ephemeral: true });
            return;
        }


        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('playarea_discard_select')
            .setPlaceholder('Select a card to discard from your play area')
            .addOptions(options.slice(0, 25)); // Take first 25

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const selectionMessage = await interaction.editReply({
            content: 'Which card would you like to discard from your play area?',
            components: [row],
            ephemeral: true
        });

        const collectorFilter = i => i.user.id === interaction.user.id && i.customId === 'playarea_discard_select';
        try {
            const selectionInteraction = await selectionMessage.awaitMessageComponent({ filter: collectorFilter, time: 60000 }); // 60 seconds

            const selectedCardId = selectionInteraction.values[0];
            const cardIndex = findIndex(player.playArea, { id: selectedCardId });
            if (cardIndex === -1) {
                // This should not happen if selection is from the generated list
                await selectionInteraction.update({ content: "Error: Selected card not found in your play area. Please try again.", components: [], ephemeral: true });
                return;
            }

            const [discardedCard] = player.playArea.splice(cardIndex, 1);

            let deck = find(gameData.decks, { name: discardedCard.origin });
            if (deck && deck.piles && deck.piles.discard) {
                deck.piles.discard.cards.push(discardedCard);
            } else {
                // Critical error: cannot find discard pile. Return card to play area.
                player.playArea.splice(cardIndex, 0, discardedCard); // Add back
                client.logger.log(`Critical Error: Deck or discard pile not found for card origin '${discardedCard.origin}' in /cards playareadiscard. Card '${discardedCard.name}' returned to play area.`, 'error');
                await selectionInteraction.update({ content: `Error: Could not find the discard pile for card '${discardedCard.name}'. It has been returned to your play area.`, components: [], ephemeral: true });
                // No game data save here as we reverted the change.
                return;
            }

            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

            await selectionInteraction.update({
                content: `You discarded '${Formatter.cardShortName(discardedCard)}' from your play area.`,
                components: [] // Remove the select menu
            });

            // Optionally, send a public confirmation if desired
            // await interaction.followUp({ content: `${interaction.member.displayName} discarded a card from their play area.` });


        } catch (e) {
            if (e.code === 'InteractionCollectorError') { // Timeout
                await interaction.editReply({ content: 'Card selection timed out. Please try the command again.', components: [], ephemeral: true });
            } else {
                client.logger.log(e, 'error');
                await interaction.editReply({ content: 'An error occurred during card selection.', components: [], ephemeral: true });
            }
        }
    }
};
