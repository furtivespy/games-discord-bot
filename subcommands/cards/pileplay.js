const { MessageFlags } = require("discord.js");
const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class PilePlay {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true)
            const gameData = await GameHelper.getGameData(client, interaction)
            
            if (focusedOption.name === 'pile') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedOption.value))
            } else if (focusedOption.name === 'card') {
                const player = find(gameData.players, {userId: interaction.user.id})
                if (!player || !player.hands.main) {
                    await interaction.respond([])
                    return
                }
                await interaction.respond(GameHelper.getCardsAutocomplete(focusedOption.value, player.hands.main))
            }
            return
        }

        await interaction.deferReply()
        
        const gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        const cardId = interaction.options.getString('card')
        const pileId = interaction.options.getString('pile')
        
        const player = find(gameData.players, {userId: interaction.user.id})
        if (!player || findIndex(player.hands.main, {id: cardId}) === -1) {
            await interaction.editReply({ content: "You don't have that card!"})
            return
        }

        const pile = GameHelper.getGlobalPile(gameData, pileId)
        if (!pile) {
            await interaction.editReply({ content: `Pile not found!`})
            return
        }

        // Remove card from hand
        const cardIndex = findIndex(player.hands.main, {id: cardId})
        const [playedCard] = player.hands.main.splice(cardIndex, 1)

        // Add to pile
        pile.cards.push(playedCard)

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardName = pile.isSecret ? undefined : Formatter.cardShortName(playedCard)
            const summary = pile.isSecret 
                ? `${actorDisplayName} played a card to ${pile.name}`
                : `${actorDisplayName} played ${cardName} to ${pile.name}`
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.PLAY,
                summary,
                {
                    pileId: pile.id,
                    pileName: pile.name,
                    isSecret: pile.isSecret,
                    cardId: playedCard.id,
                    cardName: pile.isSecret ? undefined : cardName,
                    origin: playedCard.origin
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record card play to pile in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        // Public message
        const publicMessage = pile.isSecret 
            ? `${interaction.member.displayName} played a card to **${pile.name}**`
            : `${interaction.member.displayName} played a card to **${pile.name}**`

        const embeds = pile.isSecret ? [] : [Formatter.oneCard(playedCard)]

        await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
            content: publicMessage,
            additionalEmbeds: embeds
        })

        // Private follow-up with hand
        const handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
        const privateFollowup = { embeds: [...handInfo.embeds], flags: MessageFlags.Ephemeral }
        if (handInfo.attachments.length > 0) {
            privateFollowup.files = [...handInfo.attachments]
        }
        await interaction.followUp(privateFollowup)
    }
}

module.exports = new PilePlay()
