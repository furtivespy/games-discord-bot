const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep } = require('lodash')

class Mode {
    async execute(interaction, client) {
        const mode = interaction.options.getString('mode')

        const [, rawSecretData, mainGameData] = await Promise.all([
            interaction.deferReply(),
            client.getGameDataV2(interaction.guildId, 'secret', interaction.channelId),
            GameHelper.getGameData(client, interaction).catch(() => null)
        ])
        let secretData = Object.assign({}, cloneDeep(GameDB.defaultSecretData), rawSecretData)

        const oldMode = secretData.mode || 'normal'
        secretData.mode = mode
        await client.setGameDataV2(interaction.guildId, "secret", interaction.channelId, secretData)

        // Record history in main game
        try {
            if (mainGameData && !mainGameData.isdeleted) {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                const modeDisplay = mode === 'super-secret' ? 'Super Secret' : 'Normal'
                
                GameHelper.recordMove(
                    mainGameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.SECRET,
                    GameDB.ACTION_TYPES.MODIFY,
                    `${actorDisplayName} changed secret mode to ${modeDisplay}`,
                    {
                        playerUserId: interaction.user.id,
                        playerUsername: actorDisplayName,
                        oldMode: oldMode,
                        newMode: mode,
                        action: "secret mode changed"
                    }
                )
                
                await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, mainGameData)
            }
        } catch (error) {
            console.warn('Failed to record secret mode change in main game history:', error)
        }

        const modeDisplay = mode === 'super-secret' ? '🤐 Super Secret' : '😊 Normal'
        await interaction.editReply({ 
            content: `Secret mode changed to: **${modeDisplay}**\n\n${
                mode === 'super-secret' 
                    ? '🔒 Super Secret Mode:\n• Secret entries are ephemeral (only you see them)\n• Shows count of secrets entered, not who entered them\n• Revealed secrets are wrapped in spoiler tags' 
                    : '👁️ Normal Mode:\n• Secret entries are visible to all\n• Shows who has entered secrets\n• Revealed secrets are shown normally'
            }`})
    }
}

module.exports = new Mode()

