const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Reveal {
    async execute(interaction, client) {

        if (interaction.options.getString('confirm') == 'reveal') {
            let secretData = Object.assign(
                {},
                cloneDeep(GameDB.defaultSecretData), 
                await client.getGameDataV2(interaction.guildId, 'secret', interaction.channelId)
            )
            
            if (secretData.players.length > 0){
                secretData.isrevealed = true
                
                // Record history in main game (privacy protected - no specific secret content)
                try {
                    const mainGameData = await GameHelper.getGameData(client, interaction)
                    if (!mainGameData.isdeleted) {
                        const actorDisplayName = interaction.member?.displayName || interaction.user.username
                        const secretCount = secretData.players.filter(p => p.hassecret).length
                        const totalPlayers = secretData.players.length
                        
                        GameHelper.recordMove(
                            mainGameData,
                            interaction.user,
                            GameDB.ACTION_CATEGORIES.SECRET,
                            GameDB.ACTION_TYPES.REVEAL,
                            `${actorDisplayName} revealed all secrets to everyone`,
                            {
                                playerUserId: interaction.user.id,
                                playerUsername: actorDisplayName,
                                secretsRevealed: secretCount,
                                totalPlayersWithSecrets: totalPlayers,
                                action: "all secrets revealed"
                            }
                        )
                        
                        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, mainGameData)
                    }
                } catch (error) {
                    console.warn('Failed to record secret reveal in main game history:', error)
                }
                
                //client.setGameData(`secret-${interaction.channel.id}`, secretData)
                await client.setGameDataV2(interaction.guildId, "secret", interaction.channelId, secretData)

                // Get game data for team grouping
                let gameData = null
                try {
                    gameData = await GameHelper.getGameData(client, interaction)
                } catch (error) {
                    // Game data might not exist, that's okay
                }

                await interaction.reply({ 
                    content: `Your Secrets!`,
                    embeds: [await Formatter.SecretStatus(secretData, interaction.guild, gameData)]
                })
            } else {
                await interaction.reply({ content: `Nothing to reveal...`, ephemeral: true })
            }

        } else {
            await interaction.reply({ content: `Nothing revealed...`, ephemeral: true })
        }

    }
}


module.exports = new Reveal()