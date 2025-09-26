const Formatter = require('./GameFormatter');

class GameStatusHelper {

  static async cleanUpPreviousMessage(channel, gameData) {
    const now = Date.now();
    const sixtySeconds = 60 * 1000;

    if (gameData.lastStatusMessageId && gameData.lastStatusMessageTimestamp && (now - gameData.lastStatusMessageTimestamp < sixtySeconds)) {
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

    // Update gameData with the new message's ID and timestamp.
    if (sentMessage) {
        gameData.lastStatusMessageId = sentMessage.id;
        gameData.lastStatusMessageTimestamp = Date.now();
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
    }
  }

  static async sendPublicStatusUpdate(channel, client, gameData, options = {}) {
    // First, clean up the previous status message if it was recent.
    await this.cleanUpPreviousMessage(channel, gameData);

    // Now, always send a new, full status message.
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