const GameHelper = require('../../modules/GlobalGameHelper');
const GameDB = require('../../db/anygame.js');
const Formatter = require('../../modules/GameFormatter');
const {find, pullAllWith, isEqual } = require('lodash');
const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, SlashCommandUserOption, MessageFlags} = require('discord.js');

module.exports = {
    // Subcommand data will be part of the main /cards command builder
    // Needs: .addUserOption(option => option.setName('target').setDescription('The player to give cards to').setRequired(true))

    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const gameData = await GameHelper.getGameData(client, interaction);
        if (gameData.isdeleted) {
            return interaction.editReply({ content: "No active game found in this channel."});
        }

        const initiator = find(gameData.players, { userId: interaction.user.id });
        if (!initiator) {
            return interaction.editReply({ content: "You don't seem to be a player in the current game."});
        }

        if (!initiator.playArea || initiator.playArea.length === 0) {
            return interaction.editReply({ content: "Your play area is currently empty. Nothing to give."});
        }

        const targetUser = interaction.options.getUser('target');
        if (!targetUser) {
            return interaction.editReply({ content: "You must specify a target player to give cards to."});
        }
        if (targetUser.id === interaction.user.id) {
            return interaction.editReply({ content: "You cannot give cards to yourself."});
        }

        const targetPlayer = find(gameData.players, { userId: targetUser.id });
        if (!targetPlayer) {
            return interaction.editReply({ content: `${targetUser.username} is not a player in the current game.`});
        }

        const options = initiator.playArea.map((card, index) => ({
            label: Formatter.cardShortName(card).substring(0, 100),
            description: (card.description || `Card at position ${index + 1}`).substring(0, 100),
            value: card.id,
        }));

        if (options.length > 25) {
            await interaction.editReply({ content: "Your play area has too many cards to display in a single list for now. Only the first 25 are shown."});
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
            components: [row]});

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
                await selectionInteraction.update({ content: "No valid cards were selected or an error occurred.", components: []});
                return;
            }

            // Add to targetPlayer's playArea
            if (!targetPlayer.playArea) targetPlayer.playArea = [];
            targetPlayer.playArea.push(...givenCards);

            // Record history
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                const targetDisplayName = interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username
                const cardNames = givenCards.map(c => Formatter.cardShortName(c)).join(', ')
                
                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.CARD,
                    GameDB.ACTION_TYPES.GIVE,
                    `${actorDisplayName} gave ${givenCards.length} cards to ${targetDisplayName}'s play area: ${cardNames}`,
                    {
                        targetUserId: targetUser.id,
                        targetUsername: targetDisplayName,
                        cardCount: givenCards.length,
                        cardIds: givenCards.map(c => c.id),
                        cardNames: cardNames,
                        source: "own play area",
                        destination: "target play area"
                    }
                )
            } catch (error) {
                console.warn('Failed to record play area give in history:', error)
            }

            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

            const givenCardsList = givenCards.map(c => Formatter.cardShortName(c)).join(', ');
            await selectionInteraction.update({
                content: `You gave ${givenCards.length} card(s) to ${targetUser.username}: ${givenCardsList}.`,
                components: []
            });

            let publicFollowUpContent = `${interaction.member.displayName} gave ${givenCards.length} card(s) to ${targetUser.username}'s play area`;
            if (givenCards.length > 0) {
                publicFollowUpContent += `: ${givenCardsList}`;
            }
            if (publicFollowUpContent.length > 2000) { // Discord message limit
                publicFollowUpContent = `${interaction.member.displayName} gave ${givenCards.length} card(s) to ${targetUser.username}'s play area. (Card list too long to display).`;
            }
            await interaction.followUp({
                content: publicFollowUpContent});

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
                files: statusFiles
            });

        } catch (e) {
            if (e.code === 'InteractionCollectorError') {
                await interaction.editReply({ content: 'Card selection timed out.', components: []});
            } else {
                client.logger.log(e, 'error');
                await interaction.editReply({ content: 'An error occurred during card selection for giving.', components: []});
            }
        }
    }
};
