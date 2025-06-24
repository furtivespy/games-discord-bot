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
            .setCustomId('playarea_discard_multiselect') // Changed ID for clarity
            .setPlaceholder('Select card(s) to discard from your play area')
            .setMinValues(1)
            .setMaxValues(Math.min(options.length, 25)) // Allow selecting multiple
            .addOptions(options.slice(0, 25));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const selectionMessage = await interaction.editReply({
            content: 'Which card(s) would you like to discard from your play area?',
            components: [row],
            ephemeral: true
        });

        const collectorFilter = i => i.user.id === interaction.user.id && i.customId === 'playarea_discard_multiselect';
        try {
            const selectionInteraction = await selectionMessage.awaitMessageComponent({ filter: collectorFilter, time: 120000 }); // Increased time for multi-select

            const selectedCardIds = selectionInteraction.values;
            const discardedCards = [];
            const cardsToKeepInPlayArea = [];

            player.playArea.forEach(card => {
                if (selectedCardIds.includes(card.id)) {
                    discardedCards.push(card);
                } else {
                    cardsToKeepInPlayArea.push(card);
                }
            });

            if (discardedCards.length === 0) {
                await selectionInteraction.update({ content: "No valid cards were selected or an error occurred.", components: [], ephemeral: true });
                return;
            }

            player.playArea = cardsToKeepInPlayArea; // Update play area

            let allDiscardsSuccessful = true;
            for (const cardToDiscard of discardedCards) {
                let deck = find(gameData.decks, { name: cardToDiscard.origin });
                if (deck && deck.piles && deck.piles.discard) {
                    deck.piles.discard.cards.push(cardToDiscard);
                } else {
                    // Critical error: cannot find discard pile for one of the cards.
                    // Return this card to play area and notify.
                    player.playArea.push(cardToDiscard); // Add back this specific card
                    allDiscardsSuccessful = false;
                    client.logger.log(`Critical Error: Deck or discard pile not found for card origin '${cardToDiscard.origin}' in multi-discard. Card '${cardToDiscard.name}' returned to play area.`, 'error');
                    await interaction.followUp({ content: `Error: Could not find the discard pile for card '${Formatter.cardShortName(cardToDiscard)}'. It has been returned to your play area. Some other cards may have been discarded.`, ephemeral: true });
                }
            }

            if (allDiscardsSuccessful || discardedCards.some(c => !player.playArea.find(pc => pc.id === c.id))) { // Check if at least some cards were successfully processed for discard
                await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
            }

            // Ephemeral confirmation of action
            const successfullyDiscardedCards = discardedCards.filter(dc => !player.playArea.find(pc => pc.id === dc.id));

            if (successfullyDiscardedCards.length > 0) {
                await selectionInteraction.update({
                    content: `You discarded ${successfullyDiscardedCards.length} card(s) from your play area: ${successfullyDiscardedCards.map(c => Formatter.cardShortName(c)).join(', ')}.`,
                    components: []
                });

                // Public follow-up message
                await interaction.followUp({
                    content: `${interaction.member.displayName} discarded ${successfullyDiscardedCards.length} card(s) from their play area.`,
                    ephemeral: false
                });
            } else {
                 await selectionInteraction.update({
                    content: `No cards were ultimately discarded due to errors finding their discard piles.`,
                    components: []
                });
            }


            // Display updated play area to the player (ephemeral)
            // This can be part of the selectionInteraction.update or a new followUp
            const playAreaEmbed = new EmbedBuilder()
                .setColor(player.color || 13502711)
                .setTitle("Your Updated Play Area");

            const playAreaAttachment = await Formatter.genericCardZoneDisplay(
                player.playArea, // Send the updated playArea
                playAreaEmbed,
                "Current Cards",
                `PlayAreaUpdate-${player.userId}`
            );

            const finalEphemeralReply = {
                embeds: [playAreaEmbed],
                components: [], // clean up any previous components
                ephemeral: true
            };
            if (playAreaAttachment) {
                finalEphemeralReply.files = [playAreaAttachment];
            }
            // If selectionInteraction was already updated, use followUp for this status
            if (selectionInteraction.replied || selectionInteraction.deferred) {
                 await interaction.followUp(finalEphemeralReply);
            } else { // Should not happen with await selectionInteraction.update above
                 await selectionInteraction.update(finalEphemeralReply);
            }


        } catch (e) {
            if (e.code === 'InteractionCollectorError') { // Timeout
                await interaction.editReply({ content: 'Card selection timed out. Please try the command again.', components: [], ephemeral: true });
            } else {
                client.logger.log(e, 'error');
                await interaction.editReply({ content: 'An error occurred during card selection for discard.', components: [], ephemeral: true });
            }
        }
    }
};
