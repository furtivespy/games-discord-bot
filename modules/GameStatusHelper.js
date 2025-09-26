const Formatter = require('./GameFormatter');

class GameStatusHelper {
  static async sendGameStatus(interaction, client, gameData, options = {}) {
    const now = Date.now();
    const sixtySeconds = 60 * 1000;

    if (gameData.lastStatusMessageId && gameData.lastStatusMessageTimestamp && (now - gameData.lastStatusMessageTimestamp < sixtySeconds)) {
      try {
        const channel = interaction.channel;
        const previousMessage = await channel.messages.fetch(gameData.lastStatusMessageId);

        if (previousMessage) {
          // Edit the public message to be text-only
          await previousMessage.edit({
            content: options.content || 'Game status updated.',
            attachments: [],
            embeds: []
          });

          // But send a full, new, ephemeral status to the user who ran the command
          const ephemeralReplyPayload = await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id, options);

          const ephemeralReplyOptions = {
              ...ephemeralReplyPayload,
              ephemeral: true,
          };

          if (interaction.deferred || interaction.replied) {
              await interaction.editReply(ephemeralReplyOptions).catch(() => {});
          } else {
              await interaction.reply(ephemeralReplyOptions).catch(() => {});
          }

          return; // We are done.
        }
      } catch (error) {
        console.error("Error editing previous status message, sending a new one instead.", error);
        // If editing fails, fall through to send a new message.
      }
    }

    // If we're here, it's been >60s or editing failed. Send a new message.
    const fullReply = await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id, options);

    const replyOptions = {
        ...fullReply,
        fetchReply: true,
    };

    let sentMessage;
    if (interaction.deferred || interaction.replied) {
        sentMessage = await interaction.editReply(replyOptions);
    } else {
        sentMessage = await interaction.reply(replyOptions);
    }

    // If a new message was sent, update gameData with its ID and timestamp.
    if (sentMessage) {
        gameData.lastStatusMessageId = sentMessage.id;
        gameData.lastStatusMessageTimestamp = Date.now();
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
    }
  }

  static async sendPublicStatusUpdate(channel, client, gameData, options = {}) {
    const now = Date.now();
    const sixtySeconds = 60 * 1000;

    if (gameData.lastStatusMessageId && gameData.lastStatusMessageTimestamp && (now - gameData.lastStatusMessageTimestamp < sixtySeconds)) {
        try {
            const previousMessage = await channel.messages.fetch(gameData.lastStatusMessageId);
            if (previousMessage) {
                // Edit the previous message with the new action's content, and remove embeds/attachments
                await previousMessage.edit({
                  content: options.content || 'Game status updated.',
                  attachments: [],
                  embeds: []
                });
                return null; // Return null to indicate no update to gameData is needed
            }
        } catch (error) {
            console.error("Error editing public status, sending new one.", error);
             // If editing fails, fall through to send a new message.
        }
    }

    // If we're here, it's been >60s or editing failed. Send a new message.
    const fullReply = await Formatter.createGameStatusReply(gameData, channel.guild, client.user.id, options);
    const sentMessage = await channel.send({ ...fullReply, fetchReply: true });

    // Return the new message data so the calling command can update gameData
    return {
        lastStatusMessageId: sentMessage.id,
        lastStatusMessageTimestamp: Date.now()
    };
  }
}

module.exports = GameStatusHelper;