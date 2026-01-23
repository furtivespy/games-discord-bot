const { PermissionsBitField } = require("discord.js");

const processing = new Set();

module.exports = {
  start: (client) => {
    // Check every 30 seconds
    setInterval(() => {
      checkReminders(client);
    }, 30000);
  },
  checkReminders, // Export for testing
};

async function checkReminders(client) {
  if (!client.reminders) return;

  const now = Date.now();

  // Enmap.filter returns a new Enmap (Map-like) with the filtered entries.
  const reminders = client.reminders.filter(r => r.time <= now);

  // Enmap/Map iteration yields [key, value] pairs.
  for (const [key, reminder] of reminders) {
      if (processing.has(reminder.id)) continue;

      processing.add(reminder.id);
      try {
        await processReminder(client, reminder);
      } catch (e) {
        client.logger.error(`Error processing reminder ${reminder.id}: ${e}`);
      } finally {
        processing.delete(reminder.id);
      }
  }
}

async function processReminder(client, reminder) {
    try {
        const channel = await client.channels.fetch(reminder.channelId).catch((err) => {
            // Log channel fetch failures to Bugsnag
            client.logger.error(new Error(`Failed to fetch channel ${reminder.channelId} for reminder ${reminder.id}: ${err.message}`));
            return null;
        });

        if (channel) {
             // Check permissions
             const perms = channel.permissionsFor(client.user);
             // If perms is null (e.g. DM), we might assume we can send? Or perms might be missing.
             // But usually for guild channels it returns permissions.
             // If perms is missing (DMs), we just try to send.
             if (!perms || perms.has(PermissionsBitField.Flags.SendMessages)) {
                 try {
                     await channel.send({
                         content: `<@${reminder.userId}> Reminder: ${reminder.message}`
                     });
                 } catch (sendError) {
                     // Log actual send failures to Bugsnag with full context
                     const error = new Error(`Failed to send reminder message in channel ${reminder.channelId}`);
                     error.originalError = sendError;
                     error.reminderId = reminder.id;
                     error.userId = reminder.userId;
                     client.logger.error(error);
                 }
             } else {
                 // Log permission issues to Bugsnag as they prevent reminder delivery
                 const error = new Error(`Missing permissions to send reminder in channel ${reminder.channelId}`);
                 error.reminderId = reminder.id;
                 error.userId = reminder.userId;
                 client.logger.error(error);
             }
        } else {
            // Channel doesn't exist - log as warning (not critical, user may have deleted channel)
            client.logger.warn(`Channel ${reminder.channelId} for reminder ${reminder.id} no longer exists/accessible.`);
        }
    } catch (error) {
        // Catch-all for any unexpected errors
        const wrappedError = new Error(`Unexpected error processing reminder ${reminder.id}: ${error.message}`);
        wrappedError.originalError = error;
        wrappedError.reminder = reminder;
        client.logger.error(wrappedError);
    } finally {
        // Delete the reminder after attempting to send
        // This ensures we don't retry indefinitely even if there's a persistent error
        client.reminders.delete(reminder.id);
    }
}
