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
    const fullReply = await Formatter.createGameStatusReply(gameData, channel.guild, client.user.id, options);
    const sentMessage = await channel.send({ ...fullReply, fetchReply: true });

    // Persist the status update result to the database
    const statusUpdateResult = {
        lastStatusMessageId: sentMessage.id,
        lastStatusMessageTimestamp: Date.now()
    };
    await this.persistStatusUpdate(client, interaction, gameData, statusUpdateResult);
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