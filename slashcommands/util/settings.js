const SlashCommand = require('../../base/SlashCommand.js')
const {SlashCommandBuilder } = require('@discordjs/builders');
const { MessageFlags} = require('discord.js');
const { applyAdminDefaultMemberPermissions } = require('../../modules/qaUnlock');

class Settings extends SlashCommand {
    constructor(client){
        super(client, {
            name: "settings",
            description: "Adjust bot settings (Bot Owner)",
            permLevel: "Bot Owner",
          })
		  this.data = applyAdminDefaultMemberPermissions(
        new SlashCommandBuilder()
          .setName(this.help.name)
          .setDescription(this.help.description)
          .addStringOption(option => option.setName('setting').setDescription('The setting to adjust').setRequired(true))
          .addStringOption(option => option.setName('value').setDescription('The value to set the setting to').setRequired(false))
      )
    }

    async execute(interaction) {
        try {
          if (interaction.member.id !== this.client.config.botOwnerId) {
            return interaction.reply({content: 'You do not have permission to use this command. (Bot Owner Only)', flags: MessageFlags.Ephemeral})
          }
          const setting = interaction.options.getString('setting')
          const value = interaction.options.getString('value')
          const settings = this.client.config
          if (!value || value === '') {
            await interaction.reply({content: `The current ${setting} is ${settings[setting]}.`, flags: MessageFlags.Ephemeral})
            return
          }
          await interaction.reply({content: `Setting ${setting} set to ${value}`, flags: MessageFlags.Ephemeral})
          settings[setting] = value
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Settings
