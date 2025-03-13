const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const { AttachmentBuilder } = require('discord.js')

class Status {
    static async execute(interaction, client) {
        const gameData = await GameDB.get(interaction.channel.id)
        if (!gameData) {
            return await interaction.reply({ content: "No game in progress!", ephemeral: true })
        }

        // Get the status display
        const { attachment, embed } = await Formatter.GameStatusV2(gameData)

        // Get secret tokens for the command caller
        const player = find(gameData.players, { userId: interaction.user.id })
        const secretTokensEmbed = player ? await Formatter.playerSecretTokens(gameData, player) : null

        // Reply with public info
        await interaction.reply({ 
            files: [attachment],
            embeds: embed ? [embed] : []
        })

        // If the player has secret tokens, send them in an ephemeral followup
        if (secretTokensEmbed) {
            await interaction.followUp({
                embeds: [secretTokensEmbed],
                ephemeral: true
            })
        }
    }
}

module.exports = Status