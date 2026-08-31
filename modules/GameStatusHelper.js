const { PermissionsBitField } = require('discord.js');
const Formatter = require('./GameFormatter');

const UNKNOWN_MESSAGE_CODE = 10008;
const PINNED_STATUS_HEADER = '📌 Live game status';
const loggedMissingPinPermission = new Set();

class GameStatusHelper {

  static isPinnedStatusEnabled(gameData) {
    return gameData?.pinnedStatusEnabled === true;
  }

  static buildPinnedStatusContent() {
    const nowUnix = Math.floor(Date.now() / 1000);
    return `${PINNED_STATUS_HEADER}\n*Last updated: <t:${nowUnix}:R>*`;
  }

  static isUnknownMessageError(error) {
    return error?.code === UNKNOWN_MESSAGE_CODE;
  }

  static async cleanUpPreviousMessage(channel, gameData) {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (gameData.lastStatusMessageId && gameData.pinnedStatusMessageId &&
        gameData.lastStatusMessageId === gameData.pinnedStatusMessageId) {
      return;
    }

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
    await this.safeUpsertPinnedStatus(interaction.channel, client, interaction, gameData, fullReply);
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
    await this.safeUpsertPinnedStatus(channel, client, interaction, gameData, fullReply);
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

  static async persistPinFields(client, interaction, gameData) {
    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
  }

  static async safeUpsertPinnedStatus(channel, client, interaction, gameData, snapshotReply) {
    try {
      await this.upsertPinnedStatus(channel, client, interaction, gameData, snapshotReply);
    } catch (error) {
      console.error("Pinned status update failed.", error);
    }
  }

  static async upsertPinnedStatus(channel, client, interaction, gameData, snapshotReply = null) {
    if (!this.isPinnedStatusEnabled(gameData)) {
      return;
    }
    if (!channel) {
      return;
    }

    let snapshot = snapshotReply;
    if (!snapshot) {
      snapshot = await this.buildStatusReplyOptions(gameData, channel.guild, client.user.id, {});
    }

    const pinPayload = {
      content: this.buildPinnedStatusContent(),
      embeds: snapshot.embeds || [],
      files: snapshot.files || [],
    };

    const channelMismatch = gameData.pinnedStatusChannelId && gameData.pinnedStatusChannelId !== channel.id;

    if (gameData.pinnedStatusMessageId && !channelMismatch) {
      try {
        const existing = await channel.messages.fetch(gameData.pinnedStatusMessageId);
        if (existing) {
          await existing.edit({
            ...pinPayload,
            attachments: [],
          });
          await this.ensurePinned(existing, channel, client, gameData, { isNew: false });
          await this.persistPinFields(client, interaction, gameData);
          return;
        }
      } catch (error) {
        if (!this.isUnknownMessageError(error)) {
          console.error("Failed to edit pinned status message.", error);
          return;
        }
        // Unknown message: recreate below.
      }
    }

    const sent = await channel.send(pinPayload);
    gameData.pinnedStatusMessageId = sent.id;
    gameData.pinnedStatusChannelId = channel.id;
    await this.ensurePinned(sent, channel, client, gameData, { isNew: true });
    await this.persistPinFields(client, interaction, gameData);
  }

  static canManageMessages(channel, client) {
    try {
      const perms = channel.permissionsFor?.(client.user);
      return Boolean(perms && perms.has(PermissionsBitField.Flags.ManageMessages));
    } catch (error) {
      console.error("Could not check Manage Messages permission for pinned status.", error);
      return false;
    }
  }

  static async ensurePinned(message, channel, client, gameData, { isNew = false } = {}) {
    if (message.pinned) {
      gameData.pinnedStatusPinned = true;
      return;
    }

    if (!this.canManageMessages(channel, client)) {
      this.logMissingPinPermission(channel);
      gameData.pinnedStatusPinned = false;
      return;
    }

    // Do not retry pin() forever after a previous failure (e.g. pin cap),
    // but do re-pin when we previously succeeded and someone later unpinned it.
    if (!isNew && gameData.pinnedStatusPinned === false) {
      return;
    }

    try {
      await message.pin();
      gameData.pinnedStatusPinned = true;
    } catch (error) {
      console.error("Failed to pin live game status message.", error);
      gameData.pinnedStatusPinned = false;
    }
  }

  static logMissingPinPermission(channel) {
    const key = channel.id || 'unknown';
    if (loggedMissingPinPermission.has(key)) {
      return;
    }
    loggedMissingPinPermission.add(key);
    console.warn(`Cannot pin live game status in channel ${key}: missing Manage Messages permission.`);
  }

  static async clearPinnedStatus(channel, client, gameData, { ended = false } = {}) {
    const messageId = gameData.pinnedStatusMessageId;
    if (messageId && channel) {
      try {
        const message = await channel.messages.fetch(messageId);
        const endedContent = ended
          ? `${PINNED_STATUS_HEADER} — this game has ended.`
          : `${PINNED_STATUS_HEADER} is off for this game.`;
        try {
          await message.edit({
            content: endedContent,
            embeds: [],
            files: [],
            attachments: [],
          });
        } catch (error) {
          console.error("Could not edit pinned status message while clearing it.", error);
        }
        if (message.pinned) {
          try {
            await message.unpin();
          } catch (error) {
            console.error("Could not unpin status message while clearing it.", error);
          }
        }
      } catch (error) {
        if (!this.isUnknownMessageError(error)) {
          console.error("Could not fetch pinned status message while clearing it.", error);
        }
      }
    }

    gameData.pinnedStatusMessageId = null;
    gameData.pinnedStatusChannelId = null;
    gameData.pinnedStatusPinned = false;
  }
}

GameStatusHelper.PINNED_STATUS_HEADER = PINNED_STATUS_HEADER;

module.exports = GameStatusHelper;
