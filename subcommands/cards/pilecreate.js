const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class PileCreate {
    async execute(interaction, client) {
        await interaction.deferReply()
        
        const gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const pileName = interaction.options.getString('name')
        const isSecret = interaction.options.getBoolean('secret') || false

        // Check if pile with same name already exists
        const existingPile = GameHelper.getGlobalPile(gameData, pileName)
        if (existingPile) {
            await interaction.editReply({ content: `A pile named "${pileName}" already exists!`, ephemeral: true })
            return
        }

        // Create the pile
        const pile = GameHelper.createGlobalPile(gameData, pileName, isSecret, interaction.user.id)

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const secretText = isSecret ? ' (secret)' : ''
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.GAME,
                GameDB.ACTION_TYPES.CREATE,
                `${actorDisplayName} created pile "${pileName}"${secretText}`,
                {
                    pileId: pile.id,
                    pileName: pile.name,
                    isSecret: pile.isSecret
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record pile creation in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const secretText = isSecret ? ' (cards will be hidden)' : ''
        await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
            content: `${interaction.member.displayName} created a new pile: **${pileName}**${secretText}`
        })
    }
}

module.exports = new PileCreate()
