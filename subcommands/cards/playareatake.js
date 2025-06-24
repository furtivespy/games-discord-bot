const GameHelper = require('../../modules/GlobalGameHelper');
const Formatter = require('../../modules/GameFormatter');
const { find, pullAllWith, isEqual } = require('lodash'); // Using pullAllWith for removing multiple items
const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, SlashCommandUserOption } = require('discord.js');

module.exports = {
    // Subcommand data will be part of the main /cards command builder
    // It needs a user option: .addUserOption(option => option.setName('target').setDescription('The player to take cards from').setRequired(true))

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const gameData = await GameHelper.getGameData(client, interaction);
        if (gameData.isdeleted) {
            return interaction.editReply({ content: "No active game found in this channel.", ephemeral: true });
        }

        const initiator = find(gameData.players, { userId: interaction.user.id });
        if (!initiator) {
            return interaction.editReply({ content: "You don't seem to be a player in the current game.", ephemeral: true });
        }

        const targetUser = interaction.options.getUser('target');
        if (!targetUser) {
            return interaction.editReply({ content: "You must specify a target player.", ephemeral: true });
        }
        if (targetUser.id === interaction.user.id) {
            return interaction.editReply({ content: "You cannot take cards from yourself. Use `/cards playarea pick` instead.", ephemeral: true });
        }

        const targetPlayer = find(gameData.players, { userId: targetUser.id });
        if (!targetPlayer) {
            return interaction.editReply({ content: `${targetUser.username} is not a player in the current game.`, ephemeral: true });
        }

        if (!targetPlayer.playArea || targetPlayer.playArea.length === 0) {
            return interaction.editReply({ content: `${targetUser.username}'s play area is currently empty. Nothing to take.`, ephemeral: true });
        }

        const options = targetPlayer.playArea.map((card, index) => ({
            label: Formatter.cardShortName(card).substring(0, 100),
            description: (card.description || `Card at position ${index + 1}`).substring(0, 100),
            value: card.id,
        }));

        if (options.length > 25) {
            await interaction.editReply({ content: `${targetUser.username}'s play area has too many cards to display in a single list for now. Only the first 25 are shown.`, ephemeral: true });
            // No return, allow picking from the first 25.
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('playarea_take_select')
            .setPlaceholder(`Select card(s) to take from ${targetUser.username}'s play area`)
            .setMinValues(1)
            .setMaxValues(Math.min(options.length, 25))
            .addOptions(options.slice(0, 25));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const selectionMessage = await interaction.editReply({
            content: `Which card(s) would you like to take from ${targetUser.username}'s play area?`,
            components: [row],
            ephemeral: true
        });

        const collectorFilter = i => i.user.id === interaction.user.id && i.customId === 'playarea_take_select';
        try {
            const selectionInteraction = await selectionMessage.awaitMessageComponent({ filter: collectorFilter, time: 120000 });

            const selectedCardIds = selectionInteraction.values;
            const takenCards = [];

            // Remove from targetPlayer's playArea and collect taken cards
            const newTargetPlayArea = [];
            targetPlayer.playArea.forEach(card => {
                if (selectedCardIds.includes(card.id)) {
                    takenCards.push(card);
                } else {
                    newTargetPlayArea.push(card);
                }
            });
            targetPlayer.playArea = newTargetPlayArea;


            if (takenCards.length === 0) {
                await selectionInteraction.update({ content: "No valid cards were selected or an error occurred.", components: [], ephemeral: true });
                return;
            }

            // Add to initiator's playArea
            if (!initiator.playArea) initiator.playArea = [];
            initiator.playArea.push(...takenCards);

            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

            const takenCardsList = takenCards.map(c => Formatter.cardShortName(c)).join(', ');
            await selectionInteraction.update({
                content: `You took ${takenCards.length} card(s) from ${targetUser.username}'s play area: ${takenCardsList}.`,
                components: []
            });

            await interaction.followUp({
                content: `${interaction.member.displayName} took ${takenCards.length} card(s) from ${targetUser.username}'s play area.`,
                ephemeral: false
            });

            // Display updated play areas (could be combined or sent separately)
            const initiatorPlayAreaEmbed = new EmbedBuilder().setTitle("Your Updated Play Area").setColor(initiator.color || 13502711);
            const initiatorAttachment = await Formatter.genericCardZoneDisplay(initiator.playArea, initiatorPlayAreaEmbed, "Your Cards", `PlayAreaUpdate-${initiator.userId}`);

            const targetPlayAreaEmbed = new EmbedBuilder().setTitle(`${targetUser.username}'s Updated Play Area`).setColor(targetPlayer.color || 13502711);
            const targetAttachment = await Formatter.genericCardZoneDisplay(targetPlayer.playArea, targetPlayAreaEmbed, "Their Cards", `PlayAreaUpdate-${targetPlayer.userId}`);

            const statusFiles = [];
            if (initiatorAttachment) statusFiles.push(initiatorAttachment);
            if (targetAttachment) statusFiles.push(targetAttachment);

            await interaction.followUp({
                content: "Updated play area statuses:",
                embeds: [initiatorPlayAreaEmbed, targetPlayAreaEmbed].filter(e => e.data.fields && e.data.fields.length > 0 || e.data.image), // Only send embeds with content
                files: statusFiles,
                ephemeral: false // Changed to public for transparency of game state change
            });

        } catch (e) {
            if (e.code === 'InteractionCollectorError') {
                await interaction.editReply({ content: 'Card selection timed out.', components: [], ephemeral: true });
            } else {
                client.logger.log(e, 'error');
                await interaction.editReply({ content: 'An error occurred during card selection for taking.', components: [], ephemeral: true });
            }
        }
    }
};
