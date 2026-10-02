const { MessageFlags, ChannelType, SlashCommandBuilder } = require("discord.js");
const SlashCommand = require('../../base/SlashCommand.js')
const { cloneDeep } = require('lodash')
const GameDB = require('../../db/anygame.js')
const Formatter = require('../../modules/GameFormatter')
const WinnerPortrait = require('../../modules/WinnerPortrait')

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
            .addChannelOption(option =>
              option
                .setName('gamechannel')
                .setDescription(`What channel was the /game in?`)
                .setRequired(true)
                .addChannelTypes(
                  ChannelType.GuildText,
                  ChannelType.GuildAnnouncement,
                  ChannelType.PublicThread,
                  ChannelType.PrivateThread,
                  ChannelType.AnnouncementThread
                )
            )
    }

    async execute(interaction) {
        try {
            const theChan = interaction.options.getChannel('gamechannel')

            const [, loaded] = await Promise.all([
                interaction.deferReply(),
                this.client.getGameDataV2(interaction.guildId, 'game', theChan.id)
            ])

            let gameData = Object.assign(
                {},
                cloneDeep(GameDB.defaultGameData),
                loaded
            )

            if (gameData.winner && gameData.winner != null){

                const winEmbed = await Formatter.GameWinner(gameData, interaction.guild, theChan.id)

                await interaction.editReply({ embeds: [winEmbed] })

                try {
                    if (
                      WinnerPortrait.canReusePortrait(
                        gameData.winnerPortrait,
                        gameData.winner
                      )
                    ) {
                        const buffer = await WinnerPortrait.fetchStoredPortraitBuffer({
                            client: this.client,
                            guild: interaction.guild,
                            gameChannel: theChan,
                            portrait: gameData.winnerPortrait,
                        })
                        if (buffer) {
                            const file = WinnerPortrait.applyPortraitToEmbed(winEmbed, buffer)
                            await interaction.editReply({
                                embeds: [winEmbed],
                                files: [file],
                            })
                        }
                    }
                } catch (error) {
                    WinnerPortrait.logPortraitSkip(this.client, error)
                }

            } else {
                await interaction.editReply({ content: `${theChan.name} doesn't seem to have a winner specified...` })
            }

        } catch (e) {
            this.client.logger.log(e,'error')
            try {
                const reply = { content: "Something went wrong — please try again.", flags: MessageFlags.Ephemeral };
                if (interaction.deferred || interaction.replied) await interaction.editReply(reply);
                else await interaction.reply(reply);
            } catch (_) {}
        }
    }
}

module.exports = WinShare