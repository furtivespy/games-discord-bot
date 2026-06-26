const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class NewGame {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        )

        if (gameData.isdeleted) {
            await interaction.reply({ content: `No active game in this channel`, flags: MessageFlags.Ephemeral })
        } else {
            let players = [];

            for(let i=0; i<gameData.players.length; i++){
                let variable = `player${i+1}`
                if (interaction.options.getUser(variable) && find(gameData.players, {'userId': interaction.options.getUser(variable).id})){
                    players.push(interaction.options.getUser(variable).id);
                }
            }            
            console.log(players)
            if (players.length > 0) {
                gameData.winner = players
                
                // Record history for game end with winners
                try {
                    const actorDisplayName = interaction.member?.displayName || interaction.user.username
                    const winnerNames = players.map(playerId => {
                        const player = find(gameData.players, {userId: playerId})
                        return interaction.guild.members.cache.get(playerId)?.displayName || player?.name || playerId
                    })
                    
                    GameHelper.recordMove(
                        gameData,
                        interaction.user,
                        GameDB.ACTION_CATEGORIES.GAME,
                        GameDB.ACTION_TYPES.NOTE,
                        `${actorDisplayName} declared game winner(s): ${winnerNames.join(', ')}`,
                        {
                            winnerUserIds: players,
                            winnerUsernames: winnerNames,
                            winnerCount: players.length,
                            declaredBy: actorDisplayName,
                            gameName: gameData.name,
                            totalPlayers: gameData.players.length
                        }
                    )
                } catch (error) {
                    console.warn('Failed to record winner declaration in history:', error)
                }
                
                //client.setGameData(`game-${interaction.channel.id}`, gameData)
                await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

                const winEmbed = await Formatter.GameWinner(gameData, interaction.guild)
                winEmbed.setFooter({text: `use /winshare to tell another channel about the win!`})

                await interaction.reply({ 
                    embeds: [winEmbed]
                })
            } else {
                await interaction.reply({ content: `I can't seem to find any of those players in this game...`, flags: MessageFlags.Ephemeral })
            }

        }
    }
}


module.exports = new NewGame()