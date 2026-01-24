const SlashCommand = require('../../base/SlashCommand.js');
const { SlashCommandBuilder } = require('discord.js');

class Timezone extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "timezone",
      description: "Set your timezone for reminders",
      usage: "/timezone <timezone>",
      enabled: true,
      permLevel: "User"
    });

    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .addStringOption(option =>
        option.setName('timezone')
          .setDescription('Your timezone (e.g., America/New_York, Europe/London, Asia/Tokyo)')
          .setRequired(false));
  }

  async execute(interaction) {
    try {
      const timezone = interaction.options.getString('timezone');

      // If no timezone provided, show current timezone
      if (!timezone) {
        const userPrefs = this.client.userPreferences.get(interaction.user.id) || {};
        const currentTz = userPrefs.timezone || 'America/New_York';
        return interaction.reply({
          content: `Your current timezone is set to **${currentTz}**.\n\nTo change it, use \`/timezone <timezone>\`\nExamples: America/New_York, Europe/London, Asia/Tokyo, America/Los_Angeles\n\nSee full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones`,
          ephemeral: true
        });
      }

      // Validate timezone using moment-timezone
      const moment = require('moment-timezone');
      if (!moment.tz.zone(timezone)) {
        return interaction.reply({
          content: `"${timezone}" is not a valid timezone.\n\nPlease use a timezone from the tz database (e.g., America/New_York, Europe/London, Asia/Tokyo).\n\nSee full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones`,
          ephemeral: true
        });
      }

      // Save timezone preference
      const userPrefs = this.client.userPreferences.get(interaction.user.id) || {};
      userPrefs.timezone = timezone;
      this.client.userPreferences.set(interaction.user.id, userPrefs);

      await interaction.reply({
        content: `Your timezone has been set to **${timezone}**. Future reminders will use this timezone.`,
        ephemeral: true
      });

    } catch (e) {
      this.client.logger.error(e);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'An error occurred while setting your timezone.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'An error occurred while setting your timezone.', ephemeral: true });
      }
    }
  }
}

module.exports = Timezone;
