const { ChannelType, PermissionFlagsBits } = require("discord.js");
const { DISCORD_API_BASE } = require("../../modules/embeddedGames");

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function discordAccessStub({
  guildId = "guild-1",
  channelId = "thread-game",
  userId = "snowflake-user",
  memberStatus = 200,
  channelStatus = 200,
  channelGuildId = guildId,
  channelType = ChannelType.GuildText,
  parentId = "parent-channel",
  parentStatus = 200,
  parentGuildId = channelGuildId,
  parentOverwrites,
  rolesStatus = 200,
  guildStatus = 200,
  everyonePermissions = String(PermissionFlagsBits.ViewChannel),
  extraRoles = [],
  ownerId = "owner-1",
  memberNick = "TableWill",
  memberRoles = [],
  overwrites = [],
  threadMemberStatus = 200,
  calls = [],
} = {}) {
  return async (url) => {
    const u = String(url);
    calls.push(u);
    if (u === `${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`) {
      return jsonResponse(memberStatus, {
        user: { id: userId, username: "willsullivan", global_name: "Will" },
        nick: memberNick,
        roles: memberRoles,
      });
    }
    if (
      u ===
      `${DISCORD_API_BASE}/channels/${channelId}/thread-members/${userId}`
    ) {
      return jsonResponse(threadMemberStatus, { user_id: userId, id: userId });
    }
    if (u === `${DISCORD_API_BASE}/channels/${channelId}`) {
      return jsonResponse(channelStatus, {
        id: channelId,
        type: channelType,
        guild_id: channelGuildId,
        parent_id: parentId,
        permission_overwrites: overwrites,
      });
    }
    if (u === `${DISCORD_API_BASE}/channels/${parentId}`) {
      return jsonResponse(parentStatus, {
        id: parentId,
        type: ChannelType.GuildText,
        guild_id: parentGuildId,
        permission_overwrites: parentOverwrites ?? overwrites,
      });
    }
    if (u === `${DISCORD_API_BASE}/guilds/${guildId}/roles`) {
      return jsonResponse(rolesStatus, [
        { id: guildId, permissions: everyonePermissions },
        ...extraRoles,
      ]);
    }
    if (u === `${DISCORD_API_BASE}/guilds/${guildId}`) {
      return jsonResponse(guildStatus, { id: guildId, owner_id: ownerId });
    }
    return null;
  };
}

function withDiscordAccess(innerFetch, options = {}) {
  const accessFetch = discordAccessStub(options);
  return async (url, init) => {
    const access = await accessFetch(url);
    if (access) return access;
    return innerFetch(url, init);
  };
}

module.exports = {
  discordAccessStub,
  jsonResponse,
  withDiscordAccess,
};
