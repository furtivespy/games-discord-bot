const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep } = require('lodash')

class Delete {
    async execute(interaction, client) {

        if (interaction.options.getString('confirm') == 'delete') {
            const [, rawGameData] = await Promise.all([
                interaction.deferReply(),
                client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
            ])
            let gameData = Object.assign({}, cloneDeep(GameDB.defaultGameData), rawGameData)

            if (!gameData.isdeleted){
                // Record history for game deletion before marking as deleted
                try {
                    const actorDisplayName = interaction.member?.displayName || interaction.user.username
                    
                    GameHelper.recordMove(
                        gameData,
                        interaction.user,
                        GameDB.ACTION_CATEGORIES.GAME,
                        GameDB.ACTION_TYPES.DELETE,
                        `${actorDisplayName} deleted the game "${gameData.name}"`,
                        {
                            gameName: gameData.name,
                            playerCount: gameData.players.length,
                            playerNames: gameData.players.map(p => 
                                interaction.guild.members.cache.get(p.userId)?.displayName || p.name || p.userId
                            ),
                            deletedBy: actorDisplayName,
                            channelId: interaction.channelId,
                            guildId: interaction.guildId
                        }
                    )
                } catch (error) {
                    console.warn('Failed to record game deletion in history:', error)
                }
                
                gameData.isdeleted = true
                //client.setGameData(`game-${interaction.channel.id}`, gameData)
                await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
                await interaction.editReply({ content: `Game Deleted!?` })
            } else {
                await interaction.editReply({ content: `No Active Game to Delete...`})
            }

        } else {
            await interaction.reply({ content: `Nothing Deleted...`, flags: MessageFlags.Ephemeral })
        }

        
    }
}


module.exports = new Delete()