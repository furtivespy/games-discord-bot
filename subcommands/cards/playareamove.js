const GameHelper = require('../../modules/GlobalGameHelper');
const GameDB = require('../../db/anygame.js');
const Formatter = require('../../modules/GameFormatter');
const {find } = require('lodash');
const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, MessageFlags} = require('discord.js');

module.exports = {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true);
            const gameData = await GameHelper.getGameData(client, interaction);
            
            if (focusedOption.name === 'pilename') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedOption.value));
            } else if (focusedOption.name === 'destinationplayer') {
                // Autocomplete for destination player (when destination is playarea)
                const players = gameData.players || [];
                const focusedValue = focusedOption.value.toLowerCase();
                const matches = players
                    .filter(p => {
                        const member = interaction.guild.members.cache.get(p.userId);
                        const displayName = member?.displayName || p.name || `Player ${p.order}`;
                        return displayName.toLowerCase().includes(focusedValue);
                    })
                    .slice(0, 25)
                    .map(p => {
                        const member = interaction.guild.members.cache.get(p.userId);
                        const displayName = member?.displayName || p.name || `Player ${p.order}`;
                        return {
                            name: displayName,
                            value: p.userId
                        };
                    });
                await interaction.respond(matches);
            }
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const gameData = await GameHelper.getGameData(client, interaction);
        if (gameData.isdeleted) {
            return interaction.editReply({ content: "No active game found in this channel."});
        }

        const initiator = find(gameData.players, { userId: interaction.user.id });
        if (!initiator) {
            return interaction.editReply({ content: "You don't seem to be a player in the current game."});
        }

        const sourceUser = interaction.options.getUser('source');
        if (!sourceUser) {
            return interaction.editReply({ content: "You must specify a source player."});
        }

        const sourcePlayer = find(gameData.players, { userId: sourceUser.id });
        if (!sourcePlayer) {
            return interaction.editReply({ content: `${sourceUser.username} is not a player in the current game.`});
        }

        if (!sourcePlayer.playArea || sourcePlayer.playArea.length === 0) {
            return interaction.editReply({ content: `${sourceUser.username}'s play area is currently empty. Nothing to move.`});
        }

        const destination = interaction.options.getString('destination');
        if (!destination) {
            return interaction.editReply({ content: "You must specify a destination."});
        }

        const pileId = interaction.options.getString('pilename');
        const destinationPlayerId = interaction.options.getString('destinationplayer');

        // Validate destination-specific requirements
        if (destination === 'pile' && !pileId) {
            return interaction.editReply({ content: "You must specify a pile name when destination is 'Custom Pile'."});
        }

        if (destination === 'playarea' && !destinationPlayerId) {
            return interaction.editReply({ content: "You must specify a destination player when destination is 'Play Area'."});
        }

        if (destination === 'playarea') {
            const destinationPlayer = find(gameData.players, { userId: destinationPlayerId });
            if (!destinationPlayer) {
                return interaction.editReply({ content: "Destination player not found in the game."});
            }
            if (destinationPlayerId === sourceUser.id) {
                return interaction.editReply({ content: "Cannot move cards to the same play area they came from. Use `/cards playarea pick` to move cards from your play area to your hand."});
            }
        }

        // Card selection menu
        const options = sourcePlayer.playArea.map((card, index) => ({
            label: Formatter.cardShortName(card).substring(0, 100),
            description: (card.description || `Card at position ${index + 1}`).substring(0, 100),
            value: card.id,
        }));

        if (options.length > 25) {
            await interaction.editReply({ content: `${sourceUser.username}'s play area has too many cards to display in a single list. Only the first 25 are shown.`});
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('playarea_move_select')
            .setPlaceholder(`Select card(s) to move from ${sourceUser.username}'s play area`)
            .setMinValues(1)
            .setMaxValues(Math.min(options.length, 25))
            .addOptions(options.slice(0, 25));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const selectionMessage = await interaction.editReply({
            content: `Which card(s) would you like to move from ${sourceUser.username}'s play area?`,
            components: [row]});

        const collectorFilter = i => i.user.id === interaction.user.id && i.customId === 'playarea_move_select';
        try {
            const selectionInteraction = await selectionMessage.awaitMessageComponent({ filter: collectorFilter, time: 120000 });

            const selectedCardIds = selectionInteraction.values;
            const movedCards = [];

            // Remove from sourcePlayer's playArea and collect moved cards
            const newSourcePlayArea = [];
            sourcePlayer.playArea.forEach(card => {
                if (selectedCardIds.includes(card.id)) {
                    movedCards.push(card);
                } else {
                    newSourcePlayArea.push(card);
                }
            });
            sourcePlayer.playArea = newSourcePlayArea;

            if (movedCards.length === 0) {
                await selectionInteraction.update({ content: "No valid cards were selected or an error occurred.", components: []});
                return;
            }

            let destinationName = '';
            let allMovesSuccessful = true;

            // Handle different destinations
            if (destination === 'pile') {
                const pile = GameHelper.getGlobalPile(gameData, pileId);
                if (!pile) {
                    // Return cards to source play area if pile not found
                    sourcePlayer.playArea.push(...movedCards);
                    await selectionInteraction.update({ content: 'Pile not found! Cards returned to source play area.', components: []});
                    return;
                }
                pile.cards.push(...movedCards);
                destinationName = pile.name;
            } else if (destination === 'playarea') {
                const destinationPlayer = find(gameData.players, { userId: destinationPlayerId });
                if (!destinationPlayer) {
                    sourcePlayer.playArea.push(...movedCards);
                    await selectionInteraction.update({ content: 'Destination player not found! Cards returned to source play area.', components: []});
                    return;
                }
                if (!destinationPlayer.playArea) {
                    destinationPlayer.playArea = [];
                }
                destinationPlayer.playArea.push(...movedCards);
                const destMember = interaction.guild.members.cache.get(destinationPlayerId);
                destinationName = destMember?.displayName || destinationPlayer.name || `Player ${destinationPlayer.order}`;
                destinationName += "'s play area";
            } else if (destination === 'gameboard') {
                if (!gameData.gameBoard) {
                    gameData.gameBoard = [];
                }
                gameData.gameBoard.push(...movedCards);
                destinationName = 'Game Board';
            } else if (destination === 'discard') {
                // Move to discard piles based on card origin
                for (const cardToDiscard of movedCards) {
                    let deck = find(gameData.decks, { name: cardToDiscard.origin });
                    if (deck && deck.piles && deck.piles.discard) {
                        deck.piles.discard.cards.push(cardToDiscard);
                    } else {
                        // Return card to source play area if discard pile not found
                        sourcePlayer.playArea.push(cardToDiscard);
                        allMovesSuccessful = false;
                        client.logger.log(`Error: Deck or discard pile not found for card origin '${cardToDiscard.origin}' in playarea move. Card '${cardToDiscard.name}' returned to source play area.`, 'error');
                    }
                }
                destinationName = 'discard pile(s)';
            }

            // Record history
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username;
                const sourceDisplayName = interaction.guild.members.cache.get(sourceUser.id)?.displayName || sourceUser.username;
                const successfullyMovedCards = movedCards.filter(c => !sourcePlayer.playArea.find(pc => pc.id === c.id));
                const cardNames = successfullyMovedCards.map(c => Formatter.cardShortName(c)).join(', ');
                
                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.CARD,
                    GameDB.ACTION_TYPES.TAKE,
                    `${actorDisplayName} moved ${successfullyMovedCards.length} cards from ${sourceDisplayName}'s play area to ${destinationName}: ${cardNames}`,
                    {
                        sourceUserId: sourceUser.id,
                        sourceUsername: sourceDisplayName,
                        cardCount: successfullyMovedCards.length,
                        cardIds: successfullyMovedCards.map(c => c.id),
                        cardNames: cardNames,
                        source: "source play area",
                        destination: destinationName,
                        destinationType: destination
                    }
                );
            } catch (error) {
                console.warn('Failed to record play area move in history:', error);
            }

            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

            const successfullyMovedCards = movedCards.filter(c => !sourcePlayer.playArea.find(pc => pc.id === c.id));
            const movedCardsList = successfullyMovedCards.map(c => Formatter.cardShortName(c)).join(', ');

            if (successfullyMovedCards.length > 0) {
                await selectionInteraction.update({
                    content: `You moved ${successfullyMovedCards.length} card(s) from ${sourceUser.username}'s play area to ${destinationName}: ${movedCardsList}.`,
                    components: []
                });

                let publicFollowUpContent = `${interaction.member.displayName} moved ${successfullyMovedCards.length} card(s) from ${sourceUser.username}'s play area to ${destinationName}`;
                if (successfullyMovedCards.length > 0 && movedCardsList.length < 500) {
                    publicFollowUpContent += `: ${movedCardsList}`;
                }
                if (publicFollowUpContent.length > 2000) {
                    publicFollowUpContent = `${interaction.member.displayName} moved ${successfullyMovedCards.length} card(s) from ${sourceUser.username}'s play area to ${destinationName}. (Card list too long to display).`;
                }
                await interaction.followUp({
                    content: publicFollowUpContent});
            } else {
                await selectionInteraction.update({
                    content: `No cards were moved due to errors.`,
                    components: []
                });
            }

            // Display updated play areas if source or destination is a play area
            if (destination === 'playarea' || sourceUser.id === interaction.user.id) {
                const sourcePlayAreaEmbed = new EmbedBuilder()
                    .setTitle(`${sourceUser.username}'s Updated Play Area`)
                    .setColor(sourcePlayer.color || 13502711);
                const sourceAttachment = await Formatter.genericCardZoneDisplay(
                    sourcePlayer.playArea,
                    sourcePlayAreaEmbed,
                    "Their Cards",
                    `PlayAreaUpdate-${sourcePlayer.userId}`
                );

                const statusFiles = [];
                if (sourceAttachment) statusFiles.push(sourceAttachment);
                const embeds = [sourcePlayAreaEmbed].filter(e => e.data.fields && e.data.fields.length > 0 || e.data.image);

                if (destination === 'playarea') {
                    const destinationPlayer = find(gameData.players, { userId: destinationPlayerId });
                    const destMember = interaction.guild.members.cache.get(destinationPlayerId);
                    const destDisplayName = destMember?.displayName || destinationPlayer.name || `Player ${destinationPlayer.order}`;
                    
                    const destPlayAreaEmbed = new EmbedBuilder()
                        .setTitle(`${destDisplayName}'s Updated Play Area`)
                        .setColor(destinationPlayer.color || 13502711);
                    const destAttachment = await Formatter.genericCardZoneDisplay(
                        destinationPlayer.playArea,
                        destPlayAreaEmbed,
                        "Their Cards",
                        `PlayAreaUpdate-${destinationPlayer.userId}`
                    );

                    if (destAttachment) statusFiles.push(destAttachment);
                    embeds.push(destPlayAreaEmbed);
                }

                if (embeds.length > 0 || statusFiles.length > 0) {
                    await interaction.followUp({
                        content: "Updated play area statuses:",
                        embeds: embeds.filter(e => e.data.fields && e.data.fields.length > 0 || e.data.image),
                        files: statusFiles});
                }
            }

        } catch (e) {
            if (e.code === 'InteractionCollectorError') {
                await interaction.editReply({ content: 'Card selection timed out.', components: []});
            } else {
                client.logger.log(e, 'error');
                await interaction.editReply({ content: 'An error occurred during card selection for moving.', components: []});
            }
        }
    }
};
