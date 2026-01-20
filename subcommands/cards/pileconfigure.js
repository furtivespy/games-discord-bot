const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')

class PileConfigure {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const gameData = await GameHelper.getGameData(client, interaction)
            const focusedValue = interaction.options.getString('pile')
            await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedValue))
            return
        }

        await interaction.deferReply({ ephemeral: true })
        
        const gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const pileId = interaction.options.getString('pile')
        const config = interaction.options.getString('config')
        const value = interaction.options.getBoolean('value')

        const pile = GameHelper.getGlobalPile(gameData, pileId)
        if (!pile) {
            await interaction.editReply({ content: `Pile not found!`, ephemeral: true })
            return
        }

        let changeDescription = ''
        
        if (config === 'secret') {
            const oldSetting = pile.isSecret
            pile.isSecret = value
            changeDescription = value ? 'secret (cards hidden)' : 'public (cards visible)'
            
            // Record history
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                
                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.GAME,
                    GameDB.ACTION_TYPES.MODIFY,
                    `${actorDisplayName} set pile "${pile.name}" to ${changeDescription}`,
                    {
                        pileId: pile.id,
                        pileName: pile.name,
                        configType: 'secret',
                        oldValue: oldSetting,
                        newValue: value
                    },
                    actorDisplayName
                )
            } catch (error) {
                console.warn('Failed to record pile configuration in history:', error)
            }
        } else if (config === 'showtopcard') {
            const oldSetting = pile.showTopCard
            pile.showTopCard = value
            changeDescription = value ? 'showing top card' : 'hiding top card'
            
            // Record history
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                
                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.GAME,
                    GameDB.ACTION_TYPES.MODIFY,
                    `${actorDisplayName} set pile "${pile.name}" to ${changeDescription}`,
                    {
                        pileId: pile.id,
                        pileName: pile.name,
                        configType: 'showTopCard',
                        oldValue: oldSetting,
                        newValue: value
                    },
                    actorDisplayName
                )
            } catch (error) {
                console.warn('Failed to record pile configuration in history:', error)
            }
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        await interaction.editReply({ content: `Pile "${pile.name}" is now **${changeDescription}**.`, ephemeral: true })
    }
}

module.exports = new PileConfigure()
