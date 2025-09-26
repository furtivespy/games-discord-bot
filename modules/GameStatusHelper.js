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
          const textOnlyReply = Formatter.createGameStatusTextOnly(gameData, interaction.guild);

          let combinedContent = '';
          if (options.content) {
            combinedContent += options.content + '\n';
          }
          combinedContent += textOnlyReply.content;

          await previousMessage.edit({
            content: combinedContent,
            attachments: [],
            embeds: []
          });

          const confirmationMessage = { content: 'Game status has been updated in the message above.', ephemeral: true };
          if (interaction.deferred || interaction.replied) {
              await interaction.editReply(confirmationMessage).catch(() => {});
          } else {
              await interaction.reply(confirmationMessage).catch(() => {});
          }

          return;
        }
      } catch (error) {
        console.error("Error editing previous status message, sending a new one instead.", error);
      }
    }

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
                const textOnlyReply = Formatter.createGameStatusTextOnly(gameData, channel.guild);
                let combinedContent = (options.content ? options.content + '\n' : '') + textOnlyReply.content;
                await previousMessage.edit({ content: combinedContent, attachments: [], embeds: [] });
                return null; // Return null to indicate no update to gameData is needed
            }
        } catch (error) {
            console.error("Error editing status, sending new one.", error);
        }
    }

    const fullReply = await Formatter.createGameStatusReply(gameData, channel.guild, client.user.id, options);
    const sentMessage = await channel.send({ ...fullReply, fetchReply: true });

    return {
        lastStatusMessageId: sentMessage.id,
        lastStatusMessageTimestamp: Date.now()
    };
  }
}

module.exports = GameStatusHelper;