const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class Rturn {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true)
            let gameData = await GameHelper.getGameData(client, interaction)
            let player = find(gameData.players, {userId: interaction.user.id})
            
            if (focusedOption.name === 'card') {
                if (gameData.isdeleted || !player || !player.hands.main){
                    await interaction.respond([])
                    return
                }
                await interaction.respond(
                    GameHelper.getCardsAutocomplete(focusedOption.value, player.hands.main)
                );
            } else if (focusedOption.name === 'pilename') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedOption.value))
            }
            return
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        
        let gameData = await GameHelper.getGameData(client, interaction)
        let player = find(gameData.players, {userId: interaction.user.id})

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        const cardid = interaction.options.getString('card')
        const destination = interaction.options.getString('destination') || 'deck'
        const pileId = interaction.options.getString('pilename')
        
        if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
            await interaction.editReply({ content: "Something is broken! You don't have that card."})
            return
        }
        
        let card = find(player.hands.main, {id: cardid})
        player.hands.main.splice(findIndex(player.hands.main, {id: cardid}), 1)
        
        let destinationName = ''

        // Handle different destinations
        if (destination === 'pile') {
            const pile = GameHelper.getGlobalPile(gameData, pileId)
            if (!pile) {
                // Return card to hand if pile not found
                player.hands.main.push(card)
                await interaction.editReply({ content: 'Pile not found!'})
                return
            }
            // Return to top of pile
            pile.cards.push(card)
            destinationName = `top of ${pile.name}`
        } else {
            // Default to deck's draw pile
            let deck = find(gameData.decks, {name: card.origin})
            deck.piles.draw.cards.unshift(card)
            destinationName = `top of ${deck.name}`
        }

        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.RETURN,
                `${actorDisplayName} returned a card to ${destinationName}`,
                { 
                    cardId: card.id,
                    destination: destinationName,
                    destinationType: destination
                }
            )
        } catch (error) {
            console.warn('Failed to record card return in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

        await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
            content: `${interaction.member.displayName} returned a card${destination !== 'deck' ? ' to ' + destinationName : ''}`
        });

        await interaction.editReply({ content: `You returned ${Formatter.cardShortName(card)} to ${destinationName}.` });

        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player);
        const privateFollowup = { embeds: [...handInfo.embeds], flags: MessageFlags.Ephemeral };
        if (handInfo.attachments.length > 0) {
            privateFollowup.files = [...handInfo.attachments];
        }
        await interaction.followUp(privateFollowup);
    }
}

module.exports = new Rturn()