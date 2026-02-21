const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class AnonReveal {
    async execute(interaction, client) {

        if (interaction.options.getString('confirm') == 'reveal') {
            let secretData = Object.assign(
                {},
                cloneDeep(GameDB.defaultSecretData),
                await client.getGameDataV2(interaction.guildId, 'secret', interaction.channelId)
            )

            // Get game data for team grouping
            let gameData = null
            try {
                gameData = await GameHelper.getGameData(client, interaction)
            } catch (error) {
                // Game data might not exist, that's okay
            }

            if (secretData.players.length > 0){
                await interaction.reply({
                    content: `Your Secrets! Anonymously!`,
                    embeds: [await Formatter.SecretStatusAnon(secretData, interaction.guild, gameData)]
                })
            } else {
                await interaction.reply({ content: `Nothing to reveal...`, flags: MessageFlags.Ephemeral })
            }

        } else {
            await interaction.reply({ content: `Nothing revealed...`, flags: MessageFlags.Ephemeral })
        }
    }
}

module.exports = new AnonReveal()