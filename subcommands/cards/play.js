const GameHelper = require('../../modules/GlobalGameHelper')
const { sortBy, find, filter, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameDB = require('../../db/anygame')

class Play {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            if (gameData.isdeleted) { return }
            let ddplayer = find(gameData.players, {userId: interaction.user.id})
            if (!ddplayer) { return }

            await interaction.respond(
                sortBy(
                    filter(ddplayer.hands.main, 
                        crd => Formatter.cardShortName(crd).toLowerCase()
                            .includes(interaction.options.getString('card').toLowerCase())
                        ),  ['suit', 'value', 'name']).map(crd => 
                    ({name: Formatter.cardShortName(crd), value: crd.id}))
            )
            return
        }

        await interaction.deferReply()
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const cardid = interaction.options.getString('card')
        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
            await interaction.editReply({ content: "Something is broken!?", ephemeral: true })
            return
        }
        
        const cardIndex = findIndex(player.hands.main, {id: cardid})
        // It's important to get the card object before splicing, or splice and get it from the result
        const [playedCard] = player.hands.main.splice(cardIndex, 1)

        if (gameData.playToPlayArea) {
            if (!player.playArea) { // Should be initialized by defaultPlayer
                player.playArea = [];
            }
            player.playArea.push(playedCard);
            // Optional: Log or notify that it went to play area
        } else {
            let deck = find(gameData.decks, {name: playedCard.origin});
            if (deck && deck.piles && deck.piles.discard) {
                deck.piles.discard.cards.push(playedCard);
            } else {
                // Attempt to return card to hand if discard pile is not found
                player.hands.main.splice(cardIndex, 0, playedCard); // Add back to original position
                client.logger.log(`Error: Deck or discard pile not found for card origin '${playedCard.origin}' in /cards play. Card '${playedCard.name}' returned to hand.`, 'error');
                await interaction.editReply({ content: `Error: Could not find the discard pile for card '${playedCard.name}'. It has been returned to your hand.`, ephemeral: true });
                return; // Stop further processing for this play
            }
        }

        // Record this action in game history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const destination = gameData.playToPlayArea ? "play area" : "discard pile"
            const cardName = Formatter.cardShortName(playedCard)
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.PLAY,
                `${actorDisplayName} played ${cardName} to ${destination}`,
                {
                    cardId: playedCard.id,
                    cardName: cardName,
                    destination: destination,
                    origin: playedCard.origin
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record card play in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const replyEmbeds = [
            Formatter.oneCard(playedCard),
            ...Formatter.deckStatus2(gameData)
        ];
        const replyFiles = [];

        if (gameData.playToPlayArea && player.playArea && player.playArea.length > 0) {
            const { EmbedBuilder } = require('discord.js'); // Ensure EmbedBuilder is available
            const playAreaEmbed = new EmbedBuilder()
                .setColor(player.color || 13502711)
                .setTitle(`${interaction.member.displayName}'s Updated Play Area`);

            const playAreaAttachment = await Formatter.genericCardZoneDisplay(
                player.playArea,
                playAreaEmbed,
                "Current Cards in Play Area",
                `PlayAreaUpdate-${player.userId}`
            );

            if (playAreaEmbed.data.fields && playAreaEmbed.data.fields.length > 0) {
                replyEmbeds.push(playAreaEmbed);
            }
            if (playAreaAttachment) {
                replyFiles.push(playAreaAttachment);
            }
        }

        const replyOptions = {
            content: `${interaction.member.displayName} has Played:`,
            embeds: replyEmbeds
        };
        if (replyFiles.length > 0) {
            replyOptions.files = replyFiles;
        }
        await interaction.editReply(replyOptions);

        // The ephemeral follow-up for hand status remains the same
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

module.exports = new Play()