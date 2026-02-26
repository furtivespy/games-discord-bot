const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class Discard {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true)
            let gameData = await GameHelper.getGameData(client, interaction)
            let currentPlayer = find(gameData.players, {userId: interaction.user.id})
            
            if (focusedOption.name === 'card') {
                if (gameData.isdeleted || !currentPlayer || !currentPlayer.hands.main){
                    await interaction.respond([])
                    return
                }
                await interaction.respond(
                    GameHelper.getCardsAutocomplete(focusedOption.value, currentPlayer.hands.main)
                );
            } else if (focusedOption.name === 'destination') {
                await interaction.respond(GameHelper.getDestinationAutocomplete(gameData, focusedOption.value, ['discard', 'gameboard', 'pile']))
            }
            return
        }

        await interaction.deferReply({ ephemeral: true })
        
        let gameData = await GameHelper.getGameData(client, interaction)
        let player = find(gameData.players, {userId: interaction.user.id})

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const cardid = interaction.options.getString('card')
        const destination = interaction.options.getString('destination') || 'discard'
        
        if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
            await interaction.editReply({ content: "Something is broken! You don't have that card.", ephemeral: true })
            return
        }
        
        let card = find(player.hands.main, {id: cardid})
        player.hands.main.splice(findIndex(player.hands.main, {id: cardid}), 1)
        
        let destinationName = ''

        if (destination === 'gameboard') {
            if (!gameData.gameBoard) {
                gameData.gameBoard = []
            }
            gameData.gameBoard.push(card)
            destinationName = 'Game Board'
        } else if (destination === 'discard') {
            // Default to deck's discard pile
            let deck = find(gameData.decks, {name: card.origin})
            deck.piles.discard.cards.push(card)
            destinationName = `${deck.name} discard pile`
        } else {
            // Assume pile
            const pile = GameHelper.getGlobalPile(gameData, destination)
            if (!pile) {
                // Return card to hand if pile not found
                player.hands.main.push(card)
                await interaction.editReply({ content: 'Pile not found!', ephemeral: true })
                return
            }
            pile.cards.push(card)
            destinationName = pile.name
        }

        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.DISCARD,
                `${actorDisplayName} discarded a card to ${destinationName}`,
                { 
                    destination: destinationName,
                    destinationType: destination,
                    origin: card.origin 
                }
            )
        } catch (error) {
            console.warn('Failed to record card discard in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

        await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
            content: `${interaction.member.displayName} has Discarded a card${destination !== 'discard' ? ' to ' + destinationName : ''}`
        });

        await interaction.editReply({ content: `You discarded ${Formatter.cardShortName(card)}${destination !== 'discard' ? ' to ' + destinationName : ''}.` });

        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player);
        const privateFollowup = { embeds: [...handInfo.embeds], ephemeral: true };
        if (handInfo.attachments.length > 0) {
            privateFollowup.files = [...handInfo.attachments];
        }
        await interaction.followUp(privateFollowup);
    }
}

module.exports = new Discard()