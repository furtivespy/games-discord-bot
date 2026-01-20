const { PermissionsBitField } = require("discord.js");

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
      try {
        await processReminder(client, reminder);
      } catch (e) {
        client.logger.error(`Error processing reminder ${reminder.id}: ${e}`);
      }
  }
}

async function processReminder(client, reminder) {
    try {
        const channel = await client.channels.fetch(reminder.channelId).catch(() => null);

        if (channel) {
             // Check permissions
             const perms = channel.permissionsFor(client.user);
             // If perms is null (e.g. DM), we might assume we can send? Or perms might be missing.
             // But usually for guild channels it returns permissions.
             // If perms is missing (DMs), we just try to send.
             if (!perms || perms.has(PermissionsBitField.Flags.SendMessages)) {
                 await channel.send({
                     content: `<@${reminder.userId}> Reminder: ${reminder.message}`
                 });
             } else {
                 client.logger.warn(`Missing permissions to send reminder in channel ${reminder.channelId}`);
             }
        } else {
            client.logger.warn(`Channel ${reminder.channelId} for reminder ${reminder.id} no longer exists/accessible.`);
        }
    } catch (error) {
        client.logger.error(`Failed to send reminder ${reminder.id}: ${error}`);
    } finally {
        // Delete the reminder after attempting to send
        client.reminders.delete(reminder.id);
    }
}
