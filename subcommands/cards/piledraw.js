const { MessageFlags } = require("discord.js");
const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class PileDraw {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const gameData = await GameHelper.getGameData(client, interaction)
            const focusedValue = interaction.options.getString('pile')
            await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedValue))
            return
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        
        const gameData = await GameHelper.getGameData(client, interaction)
        const pileId = interaction.options.getString('pile')
        
        const player = find(gameData.players, {userId: interaction.user.id})
        
        if (!player) {
            await interaction.editReply({ content: "You must be a player in this game!"})
            return
        }

        const pile = GameHelper.getGlobalPile(gameData, pileId)
        if (!pile) {
            await interaction.editReply({ content: `Pile not found!`})
            return
        }

        if (pile.cards.length < 1) {
            await interaction.editReply({ content: `No cards in ${pile.name}!`})
            return
        }

        // Draw from the end (top) of the pile
        const drawnCard = pile.cards.pop()
        player.hands.main.push(drawnCard)

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardName = pile.isSecret ? undefined : Formatter.cardShortName(drawnCard)
            const summary = pile.isSecret
                ? `${actorDisplayName} drew a card from ${pile.name}`
                : `${actorDisplayName} drew ${cardName} from ${pile.name}`
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.DRAW,
                summary,
                {
                    pileName: pile.name,
                    pileId: pile.id,
                    isSecret: pile.isSecret,
                    cardId: drawnCard.id,
                    cardName: pile.isSecret ? undefined : cardName
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record pile draw in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await interaction.editReply({ 
            content: `You drew ${Formatter.cardShortName(drawnCard)} from ${pile.name}`})

        // Show updated hand
        const handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
        const privateFollowup = { embeds: [...handInfo.embeds], flags: MessageFlags.Ephemeral }
        if (handInfo.attachments.length > 0) {
            privateFollowup.files = [...handInfo.attachments]
        }
        await interaction.followUp(privateFollowup)
    }
}

module.exports = new PileDraw()
