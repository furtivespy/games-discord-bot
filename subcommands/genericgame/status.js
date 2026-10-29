const { MessageFlags } = require("discord.js");
const { find } = require('lodash')
const GameDB = require('../../db/anygame')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')
const { formatGameLookup } = require('../../modules/gameLookupDebug.js')

class Status {
    static async execute(interaction, client) {
        const [, gameData] = await Promise.all([
            interaction.deferReply(),
            client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        ])

        client.logger?.log?.(
            `[game-lookup] /game status guild=${interaction.guildId} channel=${interaction.channelId} present=${gameData != null} isdeleted=${gameData?.isdeleted} isdeletedType=${gameData == null ? "missing" : typeof gameData.isdeleted} name=${JSON.stringify(gameData?.name ?? null)} players=${Array.isArray(gameData?.players) ? gameData.players.length : "null"}`,
            "log"
        )

        if (!gameData || gameData.isdeleted) {
            let inspectionText = "inspect=failed"
            try {
                inspectionText = formatGameLookup(
                    client.db.inspectGameLookup(interaction.guildId, "game", interaction.channelId)
                )
            } catch (inspectErr) {
                inspectionText = `inspect=failed:${inspectErr.message}`
            }
            client.logger?.log?.(
                `[game-lookup] source=status-reply guild=${interaction.guildId} channel=${interaction.channelId} ${inspectionText}`,
                "error"
            )
            return await interaction.editReply({ content: "No game in progress!"})
        }

        // Get secret tokens for the command caller - the main status send and
        // the secondary token render are independent of each other
        const player = find(gameData.players, { userId: interaction.user.id })
        const [, secretTokensEmbed] = await Promise.all([
            GameStatusHelper.sendGameStatus(interaction, client, gameData, { content: "📊", explicitStatus: true }),
            player ? Formatter.playerSecretTokens(gameData, player) : Promise.resolve(null)
        ]);

        // If the player has secret tokens, send them in an ephemeral followup
        if (secretTokensEmbed) {
            await interaction.followUp({
                embeds: [secretTokensEmbed],
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Error sending secret token followup:", e));
        }
    }
}

module.exports = Status