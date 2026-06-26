const { MessageFlags } = require("discord.js");
const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class PileDrawMultiple {
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
        const count = interaction.options.getInteger('count')
        
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

        if (count < 1) {
            await interaction.editReply({ content: `Count must be at least 1!`})
            return
        }

        if (pile.cards.length < count) {
            await interaction.editReply({ 
                content: `Not enough cards in ${pile.name}! (has ${pile.cards.length}, requested ${count})`})
            return
        }

        // Draw cards from the end (top) of the pile
        const drawnCards = pile.cards.splice(-count, count)
        player.hands.main.push(...drawnCards)

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardNames = pile.isSecret ? undefined : drawnCards.map(c => Formatter.cardShortName(c)).join(', ')
            const summary = pile.isSecret
                ? `${actorDisplayName} drew ${count} cards from ${pile.name}`
                : `${actorDisplayName} drew ${count} cards from ${pile.name}: ${cardNames}`
            
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
                    cardCount: count,
                    cardIds: drawnCards.map(c => c.id),
                    cardNames: pile.isSecret ? undefined : cardNames
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record pile draw multiple in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        let followup = await Formatter.multiCard(drawnCards, `Cards Drawn from ${pile.name}`)
        
        await interaction.editReply({ 
            content: `You drew ${count} cards from ${pile.name}`})

        await interaction.followUp({ 
            embeds: [...followup[0]], 
            files: [...followup[1]], 
            flags: MessageFlags.Ephemeral 
        })
    }
}

module.exports = new PileDrawMultiple()
