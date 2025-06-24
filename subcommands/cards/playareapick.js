const GameHelper = require('../../modules/GlobalGameHelper');
const Formatter = require('../../modules/GameFormatter');
const { find, findIndex, pullAt } = require('lodash');
const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

module.exports = {
    // data for subcommand group is in main cards.js
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const gameData = await GameHelper.getGameData(client, interaction);
        if (gameData.isdeleted) {
            return interaction.editReply({ content: "No active game found in this channel.", ephemeral: true });
        }

        const player = find(gameData.players, { userId: interaction.user.id });
        if (!player) {
            return interaction.editReply({ content: "You don't seem to be a player in the current game.", ephemeral: true });
        }

        if (!player.playArea || player.playArea.length === 0) {
            return interaction.editReply({ content: "Your play area is currently empty. Nothing to pick.", ephemeral: true });
        }

        const options = player.playArea.map((card, index) => ({
            label: Formatter.cardShortName(card).substring(0, 100),
            description: (card.description || `Card at position ${index + 1}`).substring(0, 100),
            value: card.id,
        }));

        if (options.length === 0) {
            return interaction.editReply({ content: "No cards available in your play area to select.", ephemeral: true });
        }

        // StringSelectMenu can have max 25 options.
        if (options.length > 25) {
             // Truncate for now, or could implement pagination if many cards are common.
            await interaction.editReply({ content: "Your play area has too many cards to display in a single list for now. Only the first 25 are shown.", ephemeral: true});
            // No return, allow picking from the first 25.
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('playarea_pick_select')
            .setPlaceholder('Select card(s) to pick up from your play area')
            .setMinValues(1)
            .setMaxValues(Math.min(options.length, 25)) // Allow picking up to 25 or total cards if less
            .addOptions(options.slice(0, 25));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const selectionMessage = await interaction.editReply({
            content: 'Which card(s) would you like to pick up from your play area?',
            components: [row],
            ephemeral: true
        });

        const collectorFilter = i => i.user.id === interaction.user.id && i.customId === 'playarea_pick_select';
        try {
            const selectionInteraction = await selectionMessage.awaitMessageComponent({ filter: collectorFilter, time: 120000 }); // 120 seconds for multi-select

            const selectedCardIds = selectionInteraction.values;
            const pickedCards = [];
            const cardsToKeepInPlayArea = [];

            player.playArea.forEach(card => {
                if (selectedCardIds.includes(card.id)) {
                    pickedCards.push(card);
                } else {
                    cardsToKeepInPlayArea.push(card);
                }
            });

            if (pickedCards.length === 0) {
                await selectionInteraction.update({ content: "No valid cards were selected or an error occurred.", components: [], ephemeral: true });
                return;
            }

            player.playArea = cardsToKeepInPlayArea; // Update play area

            // Add to player's main hand
            if (!player.hands) player.hands = {};
            if (!player.hands.main) player.hands.main = { deck: "Hand", cards: [] }; // Default hand name
            player.hands.main.cards.push(...pickedCards);
            // Consider sorting hand if that's a convention: player.hands.main.cards = Formatter.cardSort(player.hands.main.cards);


            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

            // Ephemeral confirmation of action
            await selectionInteraction.update({
                content: `You picked up ${pickedCards.length} card(s) from your play area: ${pickedCards.map(c => Formatter.cardShortName(c)).join(', ')}. They have been added to your hand.`,
                components: []
            });

            // Public follow-up message
            await interaction.followUp({
                content: `${interaction.member.displayName} picked up ${pickedCards.length} card(s) from their play area.`,
                ephemeral: false
            });

            // Display updated hand and play area to the player (ephemeral)
            const handShowReply = await Formatter.playerSecretHandAndImages(gameData, player);
            await interaction.followUp({
                content: "Your updated hand and play area:",
                embeds: handShowReply.embeds,
                files: handShowReply.attachments,
                ephemeral: true
            });

        } catch (e) {
            if (e.code === 'InteractionCollectorError') { // Timeout
                await interaction.editReply({ content: 'Card selection timed out. Please try the command again.', components: [], ephemeral: true });
            } else {
                client.logger.log(e, 'error');
                await interaction.editReply({ content: 'An error occurred during card selection for picking.', components: [], ephemeral: true });
            }
        }
    }
};
