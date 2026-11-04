const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
} = require("discord.js");

const CUSTOM_ID_PREFIX = "visual";
const OPEN_ACTION = "open";
const ORIGIN_TTL_MS = 5 * 60 * 1000;

const FORUM_PARENT_TYPES = new Set(
  [ChannelType.GuildForum, ChannelType.GuildMedia].filter((type) => type != null)
);

const THREAD_TYPES = new Set(
  [
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.AnnouncementThread,
  ].filter((type) => type != null)
);

const BRIDGE_CHANNEL_TYPES = new Set(
  [ChannelType.GuildText, ChannelType.GuildAnnouncement].filter(
    (type) => type != null
  )
);

const FORUM_BLOCKED_MESSAGE =
  "Discord can't open visual mode in forum posts or forum channels. " +
  "Run `/visual` in a normal text channel, or pass a text `channel` to post an Open visual button there. " +
  "A guild-configured visual parent channel is not set up yet.";

const LAUNCH_FALLBACK_MESSAGE =
  "Could not open visual mode from this command. Use Discord's App Launcher and choose Game Bot (Launch) in this channel.";

const BUTTON_LAUNCH_FALLBACK_MESSAGE =
  "Could not open visual mode from this button. Use `/visual` in a normal text channel, or Discord's App Launcher.";

const originByUser = new Map();

function isThreadChannel(channel) {
  if (!channel) return false;
  if (typeof channel.isThread === "function") return Boolean(channel.isThread());
  return THREAD_TYPES.has(channel.type);
}

function isForumParentType(type) {
  return FORUM_PARENT_TYPES.has(type);
}

function channelDisplayName(channel) {
  if (!channel || typeof channel !== "object") return null;
  if (typeof channel.name === "string" && channel.name.trim()) {
    return channel.name.trim();
  }
  return null;
}

async function fetchChannel(client, channelId) {
  if (!client || channelId == null || channelId === "") return null;
  const id = String(channelId);
  const cached = client.channels?.cache?.get?.(id);
  if (cached) return cached;
  if (typeof client.channels?.fetch === "function") {
    try {
      return await client.channels.fetch(id);
    } catch {
      return null;
    }
  }
  return null;
}

async function resolveParentChannel(channel, client) {
  if (!channel) return null;
  if (channel.parent) return channel.parent;
  if (channel.parentId) {
    return fetchChannel(client, channel.parentId);
  }
  return null;
}

async function channelBlocksActivities(channel, client) {
  if (!channel) return false;
  if (isForumParentType(channel.type)) return true;
  if (!isThreadChannel(channel)) return false;
  const parent = await resolveParentChannel(channel, client);
  return isForumParentType(parent?.type);
}

function canPostBridgeButton(channel) {
  if (!channel || typeof channel.send !== "function") return false;
  if (channel.type == null) return true;
  return BRIDGE_CHANNEL_TYPES.has(channel.type);
}

function openVisualCustomId(originChannelId) {
  return `${CUSTOM_ID_PREFIX}:${OPEN_ACTION}:${originChannelId}`;
}

function isVisualButton(customId) {
  return typeof customId === "string" && customId.startsWith(`${CUSTOM_ID_PREFIX}:`);
}

function parseVisualButton(customId) {
  if (!isVisualButton(customId)) return null;
  const parts = String(customId).split(":");
  if (parts.length !== 3 || parts[1] !== OPEN_ACTION) return null;
  const originChannelId = parts[2];
  if (!originChannelId) return null;
  return { action: OPEN_ACTION, originChannelId };
}

function buildOpenVisualRow(originChannelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(openVisualCustomId(originChannelId))
      .setLabel("Open visual")
      .setStyle(ButtonStyle.Primary)
  );
}

function bridgePostedMessage({
  targetChannelId,
  originChannelName,
  fromForum,
} = {}) {
  const target = `<#${targetChannelId}>`;
  const from = originChannelName
    ? ` you came from ${originChannelName}`
    : " this channel";
  if (fromForum) {
    return (
      `Discord can't open Activities in forum posts. ` +
      `I posted an Open visual button in ${target}. ` +
      `Click it there to open visual — it will remember${from}.`
    );
  }
  return (
    `Posted an Open visual button in ${target}. ` +
    `Click it there to open visual with${from} as the origin.`
  );
}

function rememberOrigin(userId, record, now = Date.now()) {
  const id = String(userId || "");
  const channelName =
    typeof record?.channelName === "string" ? record.channelName.trim() : "";
  if (!id || !channelName) return false;
  originByUser.set(id, {
    originChannelId: record.originChannelId ? String(record.originChannelId) : null,
    channelName,
    hostChannelId: record.hostChannelId ? String(record.hostChannelId) : null,
    expiresAt: now + ORIGIN_TTL_MS,
  });
  return true;
}

function forgetOrigin(userId) {
  if (userId == null || userId === "") return;
  originByUser.delete(String(userId));
}

function consumeOrigin(userId, { hostChannelId, now = Date.now() } = {}) {
  const id = String(userId || "");
  const record = originByUser.get(id);
  if (!record) return null;
  if (record.expiresAt <= now) {
    originByUser.delete(id);
    return null;
  }
  if (
    hostChannelId &&
    record.hostChannelId &&
    String(hostChannelId) !== String(record.hostChannelId)
  ) {
    return null;
  }
  originByUser.delete(id);
  return record;
}

function peekOrigin(userId) {
  return originByUser.get(String(userId || "")) || null;
}

function clearOrigins() {
  originByUser.clear();
}

async function replyEphemeral(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(payload);
  }
  return interaction.reply(payload);
}

async function postOpenVisualMessage(channel, { originChannelId, originChannelName }) {
  const from = originChannelName
    ? ` This launch remembers you came from ${originChannelName}.`
    : "";
  return channel.send({
    content: `Open Game Bot visual mode.${from}`,
    components: [buildOpenVisualRow(originChannelId)],
  });
}

async function launchInPlace(interaction, { logger } = {}) {
  forgetOrigin(interaction.user?.id);
  if (typeof interaction.launchActivity !== "function") {
    return false;
  }
  try {
    await interaction.launchActivity();
    return true;
  } catch (error) {
    logger?.log?.(error, "error");
    return false;
  }
}

async function handleButton(interaction, client = interaction.client) {
  const parsed = parseVisualButton(interaction.customId);
  if (!parsed) return false;

  if (await channelBlocksActivities(interaction.channel, client)) {
    await replyEphemeral(interaction, FORUM_BLOCKED_MESSAGE);
    return true;
  }

  const originChannel = await fetchChannel(client, parsed.originChannelId);
  const originName = channelDisplayName(originChannel);
  if (originName) {
    rememberOrigin(interaction.user?.id, {
      originChannelId: parsed.originChannelId,
      channelName: originName,
      hostChannelId: interaction.channelId,
    });
  }

  if (typeof interaction.launchActivity === "function") {
    try {
      await interaction.launchActivity();
      return true;
    } catch (error) {
      forgetOrigin(interaction.user?.id);
      client?.logger?.log?.(error, "error");
    }
  } else {
    forgetOrigin(interaction.user?.id);
  }

  await replyEphemeral(interaction, BUTTON_LAUNCH_FALLBACK_MESSAGE);
  return true;
}

module.exports = {
  BUTTON_LAUNCH_FALLBACK_MESSAGE,
  CUSTOM_ID_PREFIX,
  FORUM_BLOCKED_MESSAGE,
  LAUNCH_FALLBACK_MESSAGE,
  OPEN_ACTION,
  ORIGIN_TTL_MS,
  bridgePostedMessage,
  buildOpenVisualRow,
  canPostBridgeButton,
  channelBlocksActivities,
  channelDisplayName,
  clearOrigins,
  consumeOrigin,
  forgetOrigin,
  handleButton,
  isThreadChannel,
  isVisualButton,
  launchInPlace,
  openVisualCustomId,
  parseVisualButton,
  peekOrigin,
  postOpenVisualMessage,
  rememberOrigin,
  replyEphemeral,
};
