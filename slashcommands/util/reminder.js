const SlashCommand = require('../../base/SlashCommand.js');
const { SlashCommandBuilder } = require('discord.js');
const chrono = require('chrono-node');
const { randomUUID } = require('crypto');
const moment = require('moment-timezone');

class Reminder extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "reminder",
      description: "Set a reminder for a future time",
      usage: "/reminder <when> <message>",
      enabled: true,
      permLevel: "User"
    });

    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .addStringOption(option =>
        option.setName('when')
          .setDescription('When to remind you (e.g. "in 10 minutes", "tomorrow at 5pm")')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('message')
          .setDescription('What to remind you about')
          .setRequired(true));
  }

  async execute(interaction) {
    try {
      const when = interaction.options.getString('when');
      const message = interaction.options.getString('message');

      // Get user's timezone preference (default to America/New_York)
      const userPrefs = this.client.userPreferences.get(interaction.user.id) || {};
      const userTimezone = userPrefs.timezone || 'America/New_York';

      // Get current time in user's timezone
      const nowInUserTz = moment.tz(userTimezone);
      const referenceDate = nowInUserTz.toDate();

      // Use chrono to parse the date, using "forward" logic if implied (though parseDate defaults to closest)
      // chrono.parseDate returns a Date object or null
      // We pass { forwardDate: true } to prefer future dates (e.g. "Friday" means next Friday, not last Friday)
      // Use the reference date in user's timezone so parsing is relative to their local time
      const parsedDate = chrono.parseDate(when, referenceDate, { forwardDate: true });

      if (!parsedDate || isNaN(parsedDate.getTime())) {
        return interaction.reply({
          content: `I couldn't understand when "${when}" is. Please try a different format like "in 5 minutes" or "tomorrow at 3pm".`,
          ephemeral: true
        });
      }

      const now = new Date();
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      if (parsedDate.getTime() - now.getTime() > oneYear) {
        return interaction.reply({
            content: `Please set a reminder less than 1 year in the future.`,
            ephemeral: true
        });
      }
      if (parsedDate <= referenceDate) {
        const parsedInUserTz = moment(parsedDate).tz(userTimezone).format('LLLL z');
        return interaction.reply({
          content: `That time (${parsedInUserTz}) is in the past! Please choose a future time.`,
          ephemeral: true
        });
      }

      const id = randomUUID();
      const reminder = {
        id,
        userId: interaction.user.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        time: parsedDate.getTime(),
        message: message,
        createdAt: now.getTime()
      };

      this.client.reminders.set(id, reminder);

      // Format the date nicely
      // <t:TIMESTAMP:F> is Discord timestamp format (Long Date/Time)
      // <t:TIMESTAMP:R> is Relative time (e.g. "in 10 minutes")
      const unixTime = Math.floor(parsedDate.getTime() / 1000);

      await interaction.reply({
        content: `<@${interaction.user.id}> I've scheduled a reminder for <t:${unixTime}:F> (<t:${unixTime}:R>).`
      });

    } catch (e) {
      this.client.logger.error(e);
      if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'An error occurred while setting the reminder.', ephemeral: true });
      } else {
          await interaction.reply({ content: 'An error occurred while setting the reminder.', ephemeral: true });
      }
    }
  }
}

module.exports = Reminder;
