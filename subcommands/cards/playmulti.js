const GameHelper = require('../../modules/GlobalGameHelper')
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')
const GameDB = require('../../db/anygame')

class PlayMulti {
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true })
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player){
            await interaction.editReply({ content: "Something is broken!?", ephemeral: true })
            return
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('card')
            .setPlaceholder('Select cards to play')
            .setMinValues(1)
            .setMaxValues(Math.min(player.hands.main.length, 15))
            .addOptions(
                Formatter.cardSort(player.hands.main).slice(0, 25).map(crd => 
                    ({label: Formatter.cardShortName(crd), value: crd.id})
                )  
            )

        const row = new ActionRowBuilder().addComponents(select)

        const CardsSelected = await interaction.editReply({ content: `Choose cards to play:`, components: [row], fetchReply: true })
        
        const filter = i => i.user.id === interaction.user.id && i.customId === 'card'
        let playedCards = []

        try {
            const collected = await CardsSelected.awaitMessageComponent({ filter, time: 60000 })
            playedCards = collected.values
        } catch (error) {
            return await interaction.editReply({ content: 'No cards selected', components: [] })
        }

        if (playedCards.length < 1){
            await interaction.editReply({ content: 'No cards selected', components: [] })
            return
        }
        await interaction.editReply({ content: `Processing ${playedCards.length} cards...`, components: [] })

        let successfullyPlayedObjects = [];
        let cardsPutBackInHand = [];

        for (const cardId of playedCards) {
            const cardIndex = findIndex(player.hands.main, { id: cardId });
            if (cardIndex === -1) continue; // Card already processed or not found (e.g. if IDs were duplicated in selection somehow)

            const [playedCard] = player.hands.main.splice(cardIndex, 1);

            if (gameData.playToPlayArea) {
                if (!player.playArea) player.playArea = [];
                player.playArea.push(playedCard);
                successfullyPlayedObjects.push(playedCard);
            } else {
                let deck = find(gameData.decks, { name: playedCard.origin });
                if (deck && deck.piles && deck.piles.discard) {
                    deck.piles.discard.cards.push(playedCard);
                    successfullyPlayedObjects.push(playedCard);
                } else {
                    client.logger.log(`Error: Deck or discard pile not found for card origin '${playedCard.origin}' in /cards playmulti. Card '${playedCard.name}' returned to hand.`, 'error');
                    // Add card back to hand at its original position (or end) for user to see
                    player.hands.main.splice(cardIndex, 0, playedCard);
                    cardsPutBackInHand.push(playedCard);
                }
            }
        }

        if (successfullyPlayedObjects.length > 0 || cardsPutBackInHand.length > 0) { // Save if any change or attempted change occurred
            // Record this action in game history for successfully played cards
            if (successfullyPlayedObjects.length > 0) {
                try {
                    const actorDisplayName = interaction.member?.displayName || interaction.user.username
                    const destination = gameData.playToPlayArea ? "play area" : "discard pile"
                    const cardNames = successfullyPlayedObjects.map(card => Formatter.cardShortName(card))
                    const summary = successfullyPlayedObjects.length === 1 
                        ? `${actorDisplayName} played ${cardNames[0]} to ${destination}`
                        : `${actorDisplayName} played ${successfullyPlayedObjects.length} cards to ${destination}: ${cardNames.join(', ')}`
                    
                    GameHelper.recordMove(
                        gameData,
                        interaction.user,
                        GameDB.ACTION_CATEGORIES.CARD,
                        GameDB.ACTION_TYPES.PLAY,
                        summary,
                        {
                            cardCount: successfullyPlayedObjects.length,
                            cardNames: cardNames,
                            destination: destination,
                            cardIds: successfullyPlayedObjects.map(c => c.id)
                        },
                        actorDisplayName
                    )
                } catch (error) {
                    console.warn('Failed to record multi-card play in history:', error)
                }
            }
            
            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
        }

        const replyEmbeds = [];
        const replyFiles = [];
        let playedWhereMessage = gameData.playToPlayArea ? "to their Play Area" : "to the Discard Pile";

        if (successfullyPlayedObjects.length > 0) {
            const multiCardDisplay = await Formatter.multiCard(successfullyPlayedObjects, `Cards Played by ${interaction.member.displayName}`);
            replyEmbeds.push(...multiCardDisplay[0]);
            replyFiles.push(...multiCardDisplay[1]);

            if (gameData.playToPlayArea && player.playArea && player.playArea.length > 0) {
                const { EmbedBuilder } = require('discord.js');
                const playAreaEmbed = new EmbedBuilder()
                    .setColor(player.color || 13502711)
                    .setTitle(`${interaction.member.displayName}'s Updated Play Area`);
                const playAreaAttachment = await Formatter.genericCardZoneDisplay(
                    player.playArea,
                    playAreaEmbed,
                    "Current Cards in Play Area",
                    `PlayAreaMulti-${player.userId}`
                );
                if (playAreaEmbed.data.fields && playAreaEmbed.data.fields.length > 0) {
                    replyEmbeds.push(playAreaEmbed);
                }
                if (playAreaAttachment) {
                    replyFiles.push(playAreaAttachment);
                }
            }
        }

        let mainContent = `${interaction.member.displayName} played ${successfullyPlayedObjects.length} card(s) ${playedWhereMessage}.`;
        if (cardsPutBackInHand.length > 0) {
            mainContent += `\nCould not discard ${cardsPutBackInHand.length} card(s (returned to hand): ${cardsPutBackInHand.map(c => Formatter.cardShortName(c)).join(', ')}.`;
        }
        if (successfullyPlayedObjects.length === 0 && cardsPutBackInHand.length === 0) {
             mainContent = "No cards were played (possibly due to an issue or empty selection).";
        }


        const followupOptions = { content: mainContent, components: [] };
        if (replyEmbeds.length > 0) followupOptions.embeds = replyEmbeds;
        if (replyFiles.length > 0) followupOptions.files = replyFiles;
        await interaction.followUp(followupOptions);
        
        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
        if (handInfo.attachments.length >0){
            await interaction.followUp({ 
                embeds: [...handInfo.embeds],
                files: [...handInfo.attachments],
                ephemeral: true
            })  
        } else {
            await interaction.followUp({ 
                embeds: [...handInfo.embeds],
                ephemeral: true
            })  
        }
    }
}

module.exports = new PlayMulti()