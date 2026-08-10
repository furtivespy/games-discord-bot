const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Reveal {
    async execute(interaction, client) {

        if (interaction.options.getString('confirm') == 'reveal') {
            const [, rawSecretData, mainGameData] = await Promise.all([
                interaction.deferReply(),
                client.getGameDataV2(interaction.guildId, 'secret', interaction.channelId),
                GameHelper.getGameData(client, interaction).catch(() => null)
            ])
            let secretData = Object.assign({}, cloneDeep(GameDB.defaultSecretData), rawSecretData)

            if (secretData.players.length > 0){
                secretData.isrevealed = true

                // Record history in main game (privacy protected - no specific secret content)
                try {
                    if (mainGameData && !mainGameData.isdeleted) {
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

                await interaction.editReply({
                    content: `Your Secrets!`,
                    embeds: [await Formatter.SecretStatus(secretData, interaction.guild, mainGameData)]
                })
            } else {
                await interaction.editReply({ content: `Nothing to reveal...`})
            }

        } else {
            await interaction.reply({ content: `Nothing revealed...`, flags: MessageFlags.Ephemeral })
        }

    }
}


module.exports = new Reveal()