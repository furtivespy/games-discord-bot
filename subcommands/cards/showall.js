const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const { find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameHelper = require('../../modules/GlobalGameHelper')

class ShowAll {
    async execute(interaction, client) {
        const [, gameData] = await Promise.all([
            interaction.deferReply(),
            GameHelper.getGameData(client, interaction)
        ]);

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player){
            await interaction.editReply({ content: "Something is broken!?"})
            return
        }

        const cardsInHand = player.hands?.main || []
        if (cardsInHand.length < 1) {
            await interaction.editReply({ content: "You have no cards in your hand to show."})
            return
        }

        const cardsToShow = Formatter.cardSort(cardsInHand)

        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardNames = cardsToShow.map(card => Formatter.cardShortName(card))

            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.REVEAL,
                `${actorDisplayName} revealed all ${cardsToShow.length} cards from hand`,
                {
                    cardCount: cardsToShow.length,
                    cardNames: cardNames,
                    cardIds: cardsToShow.map(card => card.id),
                    source: "hand",
                    action: "public reveal all"
                }
            )
        } catch (error) {
            console.warn('Failed to record card show all in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const [cardDisplay, handInfo] = await Promise.all([
            Formatter.multiCard(cardsToShow, `All cards in ${interaction.member?.displayName || interaction.user.username}'s hand`),
            Formatter.playerSecretHandAndImages(gameData, player)
        ]);

        const publicReply = {
            content: "Showing all cards in hand:",
            embeds: [...cardDisplay[0]]
        }
        if (cardDisplay[1].length > 0) {
            publicReply.files = [...cardDisplay[1]]
        }
        await interaction.editReply(publicReply)

        if (handInfo.attachments.length >0){
            await interaction.followUp({
                embeds: [...handInfo.embeds],
                files: [...handInfo.attachments],
                flags: MessageFlags.Ephemeral
            })
        } else {
            await interaction.followUp({
                embeds: [...handInfo.embeds],
                flags: MessageFlags.Ephemeral
            })
        }
    }
}

module.exports = new ShowAll()
