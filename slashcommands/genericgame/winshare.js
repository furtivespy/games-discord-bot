const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');
const { cloneDeep } = require('lodash')
const GameDB = require('../../db/anygame.js')
const Formatter = require('../../modules/GameFormatter')

class WinShare extends SlashCommand {
    constructor(client){
        super(client, {
            name: "winshare",
            description: "find out who won a channel's game",
            usage: "winshare",
            enabled: true,
            permLevel: "User"
          })
		  this.data = new SlashCommandBuilder()
            .setName(this.help.name)
            .setDescription(this.help.description)
            .addChannelOption(option => option.setName('gamechannel').setDescription(`What channel was the /game in?`).setRequired(true))
    }

    async execute(interaction) {
        try {
            const theChan = interaction.options.getChannel('gamechannel')

            let gameData = Object.assign(
                {},
                cloneDeep(GameDB.defaultGameData), 
                await this.client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
            )

            if (gameData.winner && gameData.winner != null){

                const winEmbed = await Formatter.GameWinner(gameData, interaction.guild)

                await interaction.reply({ 
                    embeds: [winEmbed]
                })

            } else {
                await interaction.reply({ content: `${theChan.name} doesn't seem to have a winner specified...`, ephemeral: true })
            }

        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = WinShare