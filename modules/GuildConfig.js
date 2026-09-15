const LFG_GAME_PARENT_CHANNEL_ID = "lfg_game_parent_channel_id";

class GuildConfig {
  static LFG_GAME_PARENT_CHANNEL_ID = LFG_GAME_PARENT_CHANNEL_ID;

  static unsetStartMessage() {
    return "Set the games channel first: an administrator can use `/config games-channel` to choose where Start game opens play threads.";
  }

  static normalizeChannelId(value) {
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const mention = raw.match(/^<#(\d+)>$/);
    if (mention) return mention[1];
    return raw;
  }

  static getLfgGameParentChannelId(client, guild) {
    if (!client?.getSettings || !guild) return null;
    const settings = client.getSettings(guild) || {};
    return this.normalizeChannelId(settings[LFG_GAME_PARENT_CHANNEL_ID]);
  }

  static setLfgGameParentChannelId(client, guildId, channelId) {
    const normalized = this.normalizeChannelId(channelId);
    if (!client?.writeSettings) {
      throw new Error("Guild settings storage is not available.");
    }
    client.writeSettings(String(guildId), {
      [LFG_GAME_PARENT_CHANNEL_ID]: normalized || "",
    });
    return normalized;
  }
}

module.exports = GuildConfig;
