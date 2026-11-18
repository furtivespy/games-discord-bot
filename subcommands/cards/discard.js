const { MessageFlags } = require("discord.js");
const GameHelper = require('../../modules/GlobalGameHelper')
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')
const CardMoves = require('../../modules/gameLogic/cardMoves')

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

        const [, gameData] = await Promise.all([
            interaction.deferReply({ flags: MessageFlags.Ephemeral }),
            GameHelper.getGameData(client, interaction)
        ]);
        let player = find(gameData.players, {userId: interaction.user.id})

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        const cardid = interaction.options.getString('card')
        const destination = interaction.options.getString('destination') || 'discard'
        
        if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
            await interaction.editReply({ content: "Something is broken! You don't have that card."})
            return
        }

        const result = CardMoves.discardFromHand(gameData, {
            player,
            cardId: cardid,
            destination,
            actor: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.member?.displayName || interaction.user.username,
            },
        })
        if (!result.ok) {
            await interaction.editReply({ content: result.content })
            return
        }

        const card = result.card
        const destinationName = result.destinationName

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

        const [, , handInfo] = await Promise.all([
            GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
                content: result.content
            }),
            interaction.editReply({ content: result.privateContent || `You discarded ${Formatter.cardShortName(card)}${destination !== 'discard' ? ' to ' + destinationName : ''}.` }),
            Formatter.playerSecretHandAndImages(gameData, player)
        ]);
        const privateFollowup = { embeds: [...handInfo.embeds], flags: MessageFlags.Ephemeral };
        if (handInfo.attachments.length > 0) {
            privateFollowup.files = [...handInfo.attachments];
        }
        await interaction.followUp(privateFollowup);
    }
}

module.exports = new Discard()