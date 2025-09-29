const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class Discard {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            let currentPlayer = find(gameData.players, {userId: interaction.user.id})
            if (gameData.isdeleted || !currentPlayer || !currentPlayer.hands.main){
                await interaction.respond([])
                return
            }
            await interaction.respond(
                GameHelper.getCardsAutocomplete(interaction.options.getString('card'), currentPlayer.hands.main)
            );
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
        if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
            await interaction.editReply({ content: "Something is broken! You don't have that card.", ephemeral: true })
            return
        }
        
        let card = find(player.hands.main, {id: cardid})
        let deck = find(gameData.decks, {name: card.origin})
        player.hands.main.splice(findIndex(player.hands.main, {id: cardid}), 1)
        deck.piles.discard.cards.push(card)

        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.DISCARD,
                `${actorDisplayName} has discarded a card`,
                { destinationDeck: deck.name, origin: card.origin }
            )
        } catch (error) {
            console.warn('Failed to record card discard in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

        await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
            content: `${interaction.member.displayName} has Discarded a card`
        });

        await interaction.editReply({ content: `You discarded ${Formatter.cardShortName(card)}.` });

        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player);
        const privateFollowup = { embeds: [...handInfo.embeds], ephemeral: true };
        if (handInfo.attachments.length > 0) {
            privateFollowup.files = [...handInfo.attachments];
        }
        await interaction.followUp(privateFollowup);
    }
}

module.exports = new Discard()