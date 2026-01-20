const SlashCommand = require('../../base/SlashCommand.js');
const { SlashCommandBuilder } = require('discord.js');
const chrono = require('chrono-node');
const { nanoid } = require('nanoid');

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

      // Use chrono to parse the date, using "forward" logic if implied (though parseDate defaults to closest)
      // chrono.parseDate returns a Date object or null
      // We pass { forwardDate: true } to prefer future dates (e.g. "Friday" means next Friday, not last Friday)
      const parsedDate = chrono.parseDate(when, new Date(), { forwardDate: true });

      if (!parsedDate) {
        return interaction.reply({
          content: `I couldn't understand when "${when}" is. Please try a different format like "in 5 minutes" or "tomorrow at 3pm".`,
          ephemeral: true
        });
      }

      const now = new Date();
      if (parsedDate <= now) {
         return interaction.reply({
          content: `That time (${parsedDate.toLocaleString()}) is in the past! Please choose a future time.`,
          ephemeral: true
        });
      }

      const id = nanoid();
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
        content: `I've set a reminder for **${message}** on <t:${unixTime}:F> (<t:${unixTime}:R>).`,
        ephemeral: true
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
