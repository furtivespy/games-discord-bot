const Formatter = require('./GameFormatter');

class GameStatusHelper {

  static async cleanUpPreviousMessage(channel, gameData) {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (gameData.lastStatusMessageId && gameData.lastStatusMessageTimestamp && (now - gameData.lastStatusMessageTimestamp < fiveMinutes)) {
      try {
        const previousMessage = await channel.messages.fetch(gameData.lastStatusMessageId);
        if (previousMessage) {
          await previousMessage.edit({
            content: previousMessage.content, // Preserve the original content
            attachments: [],
            embeds: []
          });
        }
      } catch (error) {
        console.error("Could not clean up previous status message. It may have been deleted.", error);
      }
    }
  }

  static async sendGameStatus(interaction, client, gameData, options = {}) {
    // First, clean up the previous status message if it was recent.
    await this.cleanUpPreviousMessage(interaction.channel, gameData);

    // Now, always send a new, full status message.
    const fullReply = await this.buildStatusReplyOptions(gameData, interaction.guild, client.user.id, options);

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

    // Update gameData with the new message's ID and timestamp.
    const statusUpdateResult = sentMessage ? {
        lastStatusMessageId: sentMessage.id,
        lastStatusMessageTimestamp: Date.now()
    } : null;
    
    await this.persistStatusUpdate(client, interaction, gameData, statusUpdateResult);
  }

  static async sendPublicStatusUpdate(interaction, client, gameData, options = {}) {
    const channel = interaction.channel;
    
    // First, clean up the previous status message if it was recent.
    await this.cleanUpPreviousMessage(channel, gameData);

    // Now, always send a new, full status message.
    const fullReply = await this.buildStatusReplyOptions(gameData, channel.guild, client.user.id, options);

    // Callers can opt in via options.resolveDeferredReply when the original
    // interaction (deferred publicly) hasn't been resolved by any other means -
    // otherwise it would be left stuck on "thinking..." while this status update
    // is posted as a separate channel message. Callers that already resolve the
    // interaction themselves (e.g. an ephemeral defer + separate editReply/followUp)
    // are unaffected, since this defaults to off and keeps sending a new channel message.
    let sentMessage;
    if (options.resolveDeferredReply && (interaction.deferred || interaction.replied)) {
        sentMessage = await interaction.editReply({ ...fullReply, fetchReply: true });
    } else {
        sentMessage = await channel.send({ ...fullReply, fetchReply: true });
    }

    // Persist the status update result to the database
    const statusUpdateResult = {
        lastStatusMessageId: sentMessage.id,
        lastStatusMessageTimestamp: Date.now()
    };
    await this.persistStatusUpdate(client, interaction, gameData, statusUpdateResult);
  }

  // Single choke point for building the full game status reply (table image,
  // embeds, etc). Rendering can fail (e.g. a bad card image URL, canvas error),
  // so this degrades to a text-only reply rather than letting the failure
  // propagate and leave the interaction with no response at all.
  static async buildStatusReplyOptions(gameData, guild, clientUserId, options = {}) {
    try {
        return await Formatter.createGameStatusReply(gameData, guild, clientUserId, options);
    } catch (error) {
        console.error('Failed to render game status; falling back to a text-only status update.', error);
        const fallback = { embeds: [], files: [] };
        fallback.content = options.content
            ? `${options.content}\n\n⚠️ Could not render the full game status due to an error.`
            : '⚠️ Could not render the full game status due to an error.';
        return fallback;
    }
  }

  static async persistStatusUpdate(client, interaction, gameData, publicUpdateResult) {
    if (publicUpdateResult) {
      gameData.lastStatusMessageId = publicUpdateResult.lastStatusMessageId;
      gameData.lastStatusMessageTimestamp = publicUpdateResult.lastStatusMessageTimestamp;
      await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
    }
  }
}

module.exports = GameStatusHelper;