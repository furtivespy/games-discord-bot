const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class AnonReveal {
    async execute(interaction, client) {

        if (interaction.options.getString('confirm') == 'reveal') {
            const [, rawSecretData, gameData] = await Promise.all([
                interaction.deferReply(),
                client.getGameDataV2(interaction.guildId, 'secret', interaction.channelId),
                GameHelper.getGameData(client, interaction).catch(() => null)
            ])
            let secretData = Object.assign({}, cloneDeep(GameDB.defaultSecretData), rawSecretData)

            if (secretData.players.length > 0){
                await interaction.editReply({
                    content: `Your Secrets! Anonymously!`,
                    embeds: [await Formatter.SecretStatusAnon(secretData, interaction.guild, gameData)]
                })
            } else {
                await interaction.editReply({ content: `Nothing to reveal...`})
            }

        } else {
            await interaction.reply({ content: `Nothing revealed...`, flags: MessageFlags.Ephemeral })
        }
    }
}

module.exports = new AnonReveal()