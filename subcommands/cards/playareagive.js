const GameHelper = require('../../modules/GlobalGameHelper');
const Formatter = require('../../modules/GameFormatter');
const { find, pullAllWith, isEqual } = require('lodash');
const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, SlashCommandUserOption } = require('discord.js');

module.exports = {
    // Subcommand data will be part of the main /cards command builder
    // Needs: .addUserOption(option => option.setName('target').setDescription('The player to give cards to').setRequired(true))

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

        if (!initiator.playArea || initiator.playArea.length === 0) {
            return interaction.editReply({ content: "Your play area is currently empty. Nothing to give.", ephemeral: true });
        }

        const targetUser = interaction.options.getUser('target');
        if (!targetUser) {
            return interaction.editReply({ content: "You must specify a target player to give cards to.", ephemeral: true });
        }
        if (targetUser.id === interaction.user.id) {
            return interaction.editReply({ content: "You cannot give cards to yourself.", ephemeral: true });
        }

        const targetPlayer = find(gameData.players, { userId: targetUser.id });
        if (!targetPlayer) {
            return interaction.editReply({ content: `${targetUser.username} is not a player in the current game.`, ephemeral: true });
        }

        const options = initiator.playArea.map((card, index) => ({
            label: Formatter.cardShortName(card).substring(0, 100),
            description: (card.description || `Card at position ${index + 1}`).substring(0, 100),
            value: card.id,
        }));

        if (options.length > 25) {
            await interaction.editReply({ content: "Your play area has too many cards to display in a single list for now. Only the first 25 are shown.", ephemeral: true});
            // No return, allow giving from the first 25.
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('playarea_give_select')
            .setPlaceholder(`Select card(s) from your play area to give to ${targetUser.username}`)
            .setMinValues(1)
            .setMaxValues(Math.min(options.length, 25))
            .addOptions(options.slice(0, 25));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const selectionMessage = await interaction.editReply({
            content: `Which card(s) would you like to give to ${targetUser.username} from your play area?`,
            components: [row],
            ephemeral: true
        });

        const collectorFilter = i => i.user.id === interaction.user.id && i.customId === 'playarea_give_select';
        try {
            const selectionInteraction = await selectionMessage.awaitMessageComponent({ filter: collectorFilter, time: 120000 });

            const selectedCardIds = selectionInteraction.values;
            const givenCards = [];

            const newInitiatorPlayArea = [];
            initiator.playArea.forEach(card => {
                if (selectedCardIds.includes(card.id)) {
                    givenCards.push(card);
                } else {
                    newInitiatorPlayArea.push(card);
                }
            });
            initiator.playArea = newInitiatorPlayArea;

            if (givenCards.length === 0) {
                await selectionInteraction.update({ content: "No valid cards were selected or an error occurred.", components: [], ephemeral: true });
                return;
            }

            // Add to targetPlayer's playArea
            if (!targetPlayer.playArea) targetPlayer.playArea = [];
            targetPlayer.playArea.push(...givenCards);

            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

            const givenCardsList = givenCards.map(c => Formatter.cardShortName(c)).join(', ');
            await selectionInteraction.update({
                content: `You gave ${givenCards.length} card(s) to ${targetUser.username}: ${givenCardsList}.`,
                components: []
            });

            await interaction.followUp({
                content: `${interaction.member.displayName} gave ${givenCards.length} card(s) to ${targetUser.username}'s play area.`,
                ephemeral: false
            });

            // Display updated play areas
            const initiatorPlayAreaEmbed = new EmbedBuilder().setTitle("Your Updated Play Area").setColor(initiator.color || 13502711);
            const initiatorAttachment = await Formatter.genericCardZoneDisplay(initiator.playArea, initiatorPlayAreaEmbed, "Your Cards", `PlayAreaUpdate-${initiator.userId}`);

            const targetPlayAreaEmbed = new EmbedBuilder().setTitle(`${targetUser.username}'s Updated Play Area`).setColor(targetPlayer.color || 13502711);
            const targetAttachment = await Formatter.genericCardZoneDisplay(targetPlayer.playArea, targetPlayAreaEmbed, "Their Cards", `PlayAreaUpdate-${targetPlayer.userId}`);

            const statusFiles = [];
            if (initiatorAttachment) statusFiles.push(initiatorAttachment);
            if (targetAttachment) statusFiles.push(targetAttachment);

            await interaction.followUp({
                content: "Updated play area statuses:",
                embeds: [initiatorPlayAreaEmbed, targetPlayAreaEmbed].filter(e => e.data.fields && e.data.fields.length > 0 || e.data.image),
                files: statusFiles,
                ephemeral: false // Changed to public for transparency of game state change
            });

        } catch (e) {
            if (e.code === 'InteractionCollectorError') {
                await interaction.editReply({ content: 'Card selection timed out.', components: [], ephemeral: true });
            } else {
                client.logger.log(e, 'error');
                await interaction.editReply({ content: 'An error occurred during card selection for giving.', components: [], ephemeral: true });
            }
        }
    }
};
