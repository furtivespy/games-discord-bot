const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const { AttachmentBuilder } = require('discord.js')

class Status {
    async execute(interaction, client) {
        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        )

        if (gameData.isdeleted) {
            await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
        } else {
            const data = await Formatter.GameStatusV2(gameData, interaction.guild)
            await interaction.reply({ 
                embeds: data.filter(item => !(item instanceof AttachmentBuilder)),
                files: data.filter(item => item instanceof AttachmentBuilder),
            })

            // Send private token information to each player
            if (gameData.tokens && gameData.tokens.length > 0) {
                for (const player of gameData.players) {
                    const secretTokens = await Formatter.playerSecretTokens(gameData, player)
                    if (secretTokens) {
                        try {
                            const member = await interaction.guild.members.fetch(player.userId)
                            await member.send({ embeds: [secretTokens] })
                        } catch (error) {
                            console.error(`Failed to send secret tokens to player ${player.userId}:`, error)
                        }
                    }
                }
            }
        }
    }
}

module.exports = new Status()