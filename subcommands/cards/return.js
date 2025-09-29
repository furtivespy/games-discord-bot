const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class Rturn {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            let player = find(gameData.players, {userId: interaction.user.id})
            if (gameData.isdeleted || !player || !player.hands.main){
                await interaction.respond([])
                return
            }
            await interaction.respond(
                GameHelper.getCardsAutocomplete(interaction.options.getString('card'), player.hands.main)
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
        deck.piles.draw.cards.unshift(card)

        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.RETURN,
                `${actorDisplayName} returned a card to the top of ${deck.name}`,
                { cardId: card.id, deckName: deck.name }
            )
        } catch (error) {
            console.warn('Failed to record card return in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

        await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
            content: `${interaction.member.displayName} returned a card`
        });

        await interaction.editReply({ content: `You returned ${Formatter.cardShortName(card)}.` });

        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player);
        const privateFollowup = { embeds: [...handInfo.embeds], ephemeral: true };
        if (handInfo.attachments.length > 0) {
            privateFollowup.files = [...handInfo.attachments];
        }
        await interaction.followUp(privateFollowup);
    }
}

module.exports = new Rturn()