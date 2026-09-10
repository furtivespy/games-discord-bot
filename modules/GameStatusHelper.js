const { AttachmentBuilder, PermissionsBitField } = require('discord.js');
const Formatter = require('./GameFormatter');

const UNKNOWN_MESSAGE_CODE = 10008;
const MISSING_PERMISSIONS_CODE = 50013;
const PINNED_STATUS_HEADER = '📌 Live game status';
const MANUAL_PIN_COMMAND_NOTICE = "\n\n⚠️ I can't pin messages in this channel. Please pin the live status message manually.";
const PINNED_STATUS_MODES = Object.freeze({
  OFF: 'off',
  ON: 'on',
  FULL: 'full',
});
const loggedMissingPinPermission = new Set();

class GameStatusHelper {

  static isValidPinnedStatusMode(mode) {
    return mode === PINNED_STATUS_MODES.OFF
      || mode === PINNED_STATUS_MODES.ON
      || mode === PINNED_STATUS_MODES.FULL;
  }

  // Prefer pinnedStatusMode. Fall back to the legacy boolean without deleting it.
  // Already-migrated mode values win even if they disagree with the old flag.
  static resolvePinnedStatusMode(gameData) {
    if (this.isValidPinnedStatusMode(gameData?.pinnedStatusMode)) {
      return gameData.pinnedStatusMode;
    }
    return gameData?.pinnedStatusEnabled === true ? PINNED_STATUS_MODES.ON : PINNED_STATUS_MODES.OFF;
  }

  // Read-time defaults only: fill missing fields, never overwrite an existing mode.
  static applyPinnedStatusModeDefaults(gameData) {
    if (!gameData || typeof gameData !== 'object') {
      return gameData;
    }
    if (gameData.pinnedStatusMode === undefined) {
      gameData.pinnedStatusMode = gameData.pinnedStatusEnabled === true
        ? PINNED_STATUS_MODES.ON
        : PINNED_STATUS_MODES.OFF;
    }
    if (gameData.pinnedStatusEnabled === undefined) {
      gameData.pinnedStatusEnabled = gameData.pinnedStatusMode === PINNED_STATUS_MODES.ON
        || gameData.pinnedStatusMode === PINNED_STATUS_MODES.FULL;
    }
    return gameData;
  }

  static setPinnedStatusMode(gameData, mode) {
    const nextMode = this.isValidPinnedStatusMode(mode) ? mode : PINNED_STATUS_MODES.OFF;
    gameData.pinnedStatusMode = nextMode;
    // Mirror the legacy boolean (pin active for on/full). Do not delete the old field.
    gameData.pinnedStatusEnabled = nextMode === PINNED_STATUS_MODES.ON
      || nextMode === PINNED_STATUS_MODES.FULL;
    return nextMode;
  }

  static isPinnedStatusEnabled(gameData) {
    const mode = this.resolvePinnedStatusMode(gameData);
    return mode === PINNED_STATUS_MODES.ON || mode === PINNED_STATUS_MODES.FULL;
  }

  // In `full` mode, skip the chat table/image unless the caller is an explicit
  // status command (/game status, /game newgame, and similar setup dumps).
  static shouldPostChatFullStatus(gameData, options = {}) {
    if (this.resolvePinnedStatusMode(gameData) !== PINNED_STATUS_MODES.FULL) {
      return true;
    }
    return options.explicitStatus === true;
  }

  // Command-owned chat payload only: never include the status table/image
  // that createGameStatusReply attaches. Card embeds/files live on
  // additionalEmbeds / additionalFiles and must survive `full` mode.
  static buildCommandNaturalReply(options = {}, { fallbackContent = null } = {}) {
    const payload = {};
    if (typeof options.content === 'string' && options.content.length > 0) {
      payload.content = options.content;
    } else if (typeof fallbackContent === 'string') {
      payload.content = fallbackContent;
    }
    if (options.additionalEmbeds?.length) {
      payload.embeds = options.additionalEmbeds;
    }
    if (options.additionalFiles?.length) {
      payload.files = options.additionalFiles;
    }
    return payload;
  }

  static commandNaturalReplyHasBody(payload) {
    return Boolean(
      (typeof payload.content === 'string' && payload.content.length > 0)
      || payload.embeds?.length
      || payload.files?.length
    );
  }

  static async resolveInteractionWithoutFullStatus(interaction, options = {}) {
    if (!interaction || interaction.replied) {
      return;
    }
    // Keep command media (card embeds/files). Content-only editReply would
    // wipe a prior bespoke reply and drop additionalEmbeds from this payload.
    const payload = this.buildCommandNaturalReply(options, { fallbackContent: '\u200b' });
    if (interaction.deferred) {
      await interaction.editReply(payload);
      return;
    }
    await interaction.reply(payload);
  }

  static async postCommandNaturalReplyToChannel(channel, options = {}) {
    if (!channel) {
      return;
    }
    const payload = this.buildCommandNaturalReply(options);
    if (!this.commandNaturalReplyHasBody(payload)) {
      return;
    }
    await channel.send(payload);
  }

  static buildPinnedStatusContent() {
    const nowUnix = Math.floor(Date.now() / 1000);
    return `${PINNED_STATUS_HEADER}\n*Last updated: <t:${nowUnix}:R>*`;
  }

  static buildManualPinCommandNotice(channel, client, gameData) {
    if (!this.isPinnedStatusEnabled(gameData) || gameData.pinnedStatusPinned === true) {
      return '';
    }
    if (!this.canManageMessages(channel, client) || gameData.pinnedStatusPinned === false) {
      return MANUAL_PIN_COMMAND_NOTICE;
    }
    return '';
  }

  static cloneReplyFiles(files) {
    if (!files?.length) {
      return [];
    }

    return files.map((file) => {
      if (file instanceof AttachmentBuilder) {
        const data = file.attachment;
        const clonedData = Buffer.isBuffer(data) ? Buffer.from(data) : data;
        return new AttachmentBuilder(clonedData, { name: file.name, description: file.description });
      }
      return file;
    });
  }

  static buildPinSnapshot(snapshotReply) {
    if (!snapshotReply) {
      return null;
    }

    return {
      embeds: snapshotReply.embeds || [],
      files: this.cloneReplyFiles(snapshotReply.files || []),
    };
  }

  static isUnknownMessageError(error) {
    const code = error?.code ?? error?.rawError?.code;
    return Number(code) === UNKNOWN_MESSAGE_CODE;
  }

  static isMissingPinPermissionError(error) {
    const code = error?.code ?? error?.rawError?.code;
    return Number(code) === MISSING_PERMISSIONS_CODE;
  }

  static async fetchPinnedMessage(channel, messageId) {
    // Force the API so a human unpin is visible; cached Message.pinned can stay true.
    return channel.messages.fetch({ message: messageId, force: true });
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
    const postChat = this.shouldPostChatFullStatus(gameData, options);

    if (postChat) {
      await this.cleanUpPreviousMessage(interaction.channel, gameData);
    }

    const fullReply = await this.buildStatusReplyOptions(gameData, interaction.guild, client.user.id, options);

    if (postChat) {
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

      const statusUpdateResult = sentMessage ? {
          lastStatusMessageId: sentMessage.id,
          lastStatusMessageTimestamp: Date.now()
      } : null;
      
      await this.persistStatusUpdate(client, interaction, gameData, statusUpdateResult);
    } else {
      // Keep the command's natural reply (content + additionalEmbeds/files)
      // and skip the table/image. Do not record this as lastStatusMessageId
      // or a later cleanup would strip the command's card media.
      await this.resolveInteractionWithoutFullStatus(interaction, options);
    }

    await this.safeUpsertPinnedStatus(
      interaction.channel,
      client,
      interaction,
      gameData,
      this.buildPinSnapshot(fullReply)
    );
  }

  static async sendPublicStatusUpdate(interaction, client, gameData, options = {}) {
    const channel = interaction.channel;
    const postChat = this.shouldPostChatFullStatus(gameData, options);
    const fullReply = await this.buildStatusReplyOptions(gameData, channel.guild, client.user.id, options);

    if (postChat) {
      await this.cleanUpPreviousMessage(channel, gameData);

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

      const statusUpdateResult = {
          lastStatusMessageId: sentMessage.id,
          lastStatusMessageTimestamp: Date.now()
      };
      await this.persistStatusUpdate(client, interaction, gameData, statusUpdateResult);
    } else if (options.resolveDeferredReply) {
      await this.resolveInteractionWithoutFullStatus(interaction, options);
    } else {
      // Same channel.send path as the full-status update, minus the table/image.
      await this.postCommandNaturalReplyToChannel(channel, options);
    }

    await this.safeUpsertPinnedStatus(
      channel,
      client,
      interaction,
      gameData,
      this.buildPinSnapshot(fullReply)
    );
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
      // Chat-status metadata only. sendGameStatus / sendPublicStatusUpdate already
      // refresh the pin after this persist; skipping the save hook avoids a loop.
      await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData, {
        skipPinnedRefresh: true,
      });
    }
  }

  static async persistPinFields(client, interaction, gameData) {
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const fresh = await client.getGameDataV2(guildId, "game", channelId);
    if (!fresh || fresh.isdeleted) {
      return;
    }

    fresh.pinnedStatusMessageId = gameData.pinnedStatusMessageId;
    fresh.pinnedStatusChannelId = gameData.pinnedStatusChannelId;
    fresh.pinnedStatusPinned = gameData.pinnedStatusPinned;
    await client.setGameDataV2(guildId, "game", channelId, fresh, { skipPinnedRefresh: true });
  }

  // After a successful channel-game persist, keep the live pin in sync when
  // pinned mode is on/full. Does not post a new chat status table.
  // Callers that only write pin/chat metadata (persistPinFields,
  // persistStatusUpdate) pass options.skipPinnedRefresh to avoid recursion.
  static async refreshPinnedStatusAfterGameSave(client, context, gameData, options = {}) {
    if (options.skipPinnedRefresh) {
      return;
    }
    if (!gameData || typeof gameData !== "object" || gameData.isdeleted) {
      return;
    }
    if (!this.isPinnedStatusEnabled(gameData)) {
      return;
    }

    const channel = await this.resolveChannelForPinnedRefresh(client, context);
    if (!channel) {
      return;
    }

    const interaction = context?.interaction || {
      guildId: context?.guildId,
      channelId: context?.channelId || channel.id,
    };

    await this.safeUpsertPinnedStatus(channel, client, interaction, gameData);
  }

  static async resolveChannelForPinnedRefresh(client, context) {
    if (context?.channel) {
      return context.channel;
    }

    const channelId = context?.channelId;
    if (!channelId || !client) {
      return null;
    }

    try {
      const cached = client.channels?.cache?.get(channelId);
      if (cached) {
        return cached;
      }
      if (typeof client.channels?.fetch === "function") {
        return await client.channels.fetch(channelId);
      }
    } catch (error) {
      console.error("Could not resolve channel for pinned status refresh after save.", error);
    }
    return null;
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
        const existing = await this.fetchPinnedMessage(channel, gameData.pinnedStatusMessageId);
        if (existing) {
          const pinnedBefore = gameData.pinnedStatusPinned;
          await existing.edit({
            ...pinPayload,
            attachments: [],
          });
          await this.ensurePinned(existing, channel, client, gameData, { isNew: false });
          // Pin ids are already stored. Rewriting the whole game doc here can
          // clobber a newer chat status persist from a concurrent command.
          if (gameData.pinnedStatusPinned !== pinnedBefore) {
            await this.persistPinFields(client, interaction, gameData);
          }
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
      if (this.isMissingPinPermissionError(error)) {
        this.logMissingPinPermission(channel);
      } else {
        console.error("Failed to pin live game status message.", error);
      }
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
        const message = await this.fetchPinnedMessage(channel, messageId);
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
GameStatusHelper.MANUAL_PIN_COMMAND_NOTICE = MANUAL_PIN_COMMAND_NOTICE;
GameStatusHelper.PINNED_STATUS_MODES = PINNED_STATUS_MODES;

module.exports = GameStatusHelper;
