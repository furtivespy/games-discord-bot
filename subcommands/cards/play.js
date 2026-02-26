const GameHelper = require('../../modules/GlobalGameHelper')
const { sortBy, find, filter, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameDB = require('../../db/anygame')

class Play {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true)
            let gameData = await GameHelper.getGameData(client, interaction)
            if (gameData.isdeleted) { return }
            let ddplayer = find(gameData.players, {userId: interaction.user.id})
            if (!ddplayer) { return }

            if (focusedOption.name === 'card') {
                await interaction.respond(
                    sortBy(
                        filter(ddplayer.hands.main, 
                            crd => Formatter.cardShortName(crd).toLowerCase()
                                .includes(focusedOption.value.toLowerCase())
                            ),  ['suit', 'value', 'name']).map(crd => 
                        ({name: Formatter.cardShortName(crd), value: crd.id}))
                )
            } else if (focusedOption.name === 'destination') {
                await interaction.respond(GameHelper.getDestinationAutocomplete(gameData, focusedOption.value, ['playarea', 'discard', 'gameboard', 'pile']))
            }
            return
        }

        await interaction.deferReply()
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const cardid = interaction.options.getString('card')
        const destination = interaction.options.getString('destination')
        
        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
            await interaction.editReply({ content: "Something is broken!?", ephemeral: true })
            return
        }
        
        const cardIndex = findIndex(player.hands.main, {id: cardid})
        const cardToPlay = player.hands.main[cardIndex] // Get card ref first
        player.hands.main.splice(cardIndex, 1) // Remove from hand

        let destinationName = ''
        let actualDestination = destination

        // If no destination specified, use playToPlayArea setting
        if (!actualDestination) {
            actualDestination = gameData.playToPlayArea ? 'playarea' : 'discard'
        }

        let destinationTypeForHistory = actualDestination

        // Handle different destinations
        if (actualDestination === 'gameboard') {
            if (!gameData.gameBoard) {
                gameData.gameBoard = []
            }
            gameData.gameBoard.push(cardToPlay)
            destinationName = 'Game Board'
        } else if (actualDestination === 'playarea') {
            if (!player.playArea) {
                player.playArea = []
            }
            player.playArea.push(cardToPlay)
            destinationName = 'play area'
        } else if (actualDestination === 'discard') {
             let deck = find(gameData.decks, {name: cardToPlay.origin})
             // Check if deck exists and has discard pile
             if (deck && deck.piles && deck.piles.discard) {
                 deck.piles.discard.cards.push(cardToPlay)
                 destinationName = 'discard pile'
             } else {
                 // Fallback if deck/discard not found - return to hand
                 player.hands.main.splice(cardIndex, 0, cardToPlay)
                 client.logger.log(`Error: Deck or discard pile not found for card origin '${cardToPlay.origin}' in /cards play.`, 'error')
                 await interaction.editReply({ content: `Error: Could not find the discard pile. Card returned to hand.`, ephemeral: true })
                 return
             }
        } else {
            // Assume pile
            const pile = GameHelper.getGlobalPile(gameData, actualDestination)
            if (pile) {
                pile.cards.push(cardToPlay)
                destinationName = pile.name
                destinationTypeForHistory = 'pile'
            } else {
                // Pile not found
                player.hands.main.splice(cardIndex, 0, cardToPlay)
                await interaction.editReply({ content: 'Destination not found (Pile or other)!', ephemeral: true })
                return
            }
        }

        // Record this action in game history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardName = Formatter.cardShortName(cardToPlay)
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.PLAY,
                `${actorDisplayName} played ${cardName} to ${destinationName}`,
                {
                    cardId: cardToPlay.id,
                    cardName: cardName,
                    destination: destinationName,
                    destinationType: destinationTypeForHistory,
                    origin: cardToPlay.origin
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record card play in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const replyEmbeds = [
            Formatter.oneCard(cardToPlay),
            ...Formatter.deckStatus2(gameData)
        ];
        const replyFiles = [];

        // If played to playarea, show updated playarea
        // Wait, if played to playarea, we should probably update the generic playarea display if possible or just show this player's playarea
        if ((actualDestination === 'playarea' || destinationTypeForHistory === 'playarea') && player.playArea && player.playArea.length > 0) {
            const { EmbedBuilder } = require('discord.js');
            const playAreaEmbed = new EmbedBuilder()
                .setColor(player.color || 13502711)
                .setTitle(`${interaction.member.displayName}'s Updated Play Area`);

            const playAreaAttachment = await Formatter.genericCardZoneDisplay(
                player.playArea,
                playAreaEmbed,
                "Current Cards in Play Area",
                `PlayAreaUpdate-${player.userId}`
            );

            if (playAreaAttachment) {
                replyFiles.push(playAreaAttachment);
            }
            // Only add if fields exist
            if (playAreaEmbed.data.fields && playAreaEmbed.data.fields.length > 0) {
                 replyEmbeds.push(playAreaEmbed);
            }
        }

        const replyOptions = {
            content: `${interaction.member.displayName} has Played to ${destinationName}:`,
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