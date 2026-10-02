const LFG_GAME_PARENT_CHANNEL_ID = "lfg_game_parent_channel_id";
const WINNER_PORTRAITS_ENABLED = "winner_portraits_enabled";

function parseEnabledFlag(raw, defaultValue) {
  if (raw == null || raw === "") return defaultValue;
  if (raw === true || raw === false) return raw;
  const normalized = String(raw).trim().toLowerCase();
  if (["false", "off", "0", "no"].includes(normalized)) return false;
  if (["true", "on", "1", "yes"].includes(normalized)) return true;
  return defaultValue;
}

class GuildConfig {
  static LFG_GAME_PARENT_CHANNEL_ID = LFG_GAME_PARENT_CHANNEL_ID;
  static WINNER_PORTRAITS_ENABLED = WINNER_PORTRAITS_ENABLED;

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

  static isWinnerPortraitsEnabled(client, guild) {
    if (!client?.getSettings || !guild) return true;
    const settings = client.getSettings(guild) || {};
    return parseEnabledFlag(settings[WINNER_PORTRAITS_ENABLED], true);
  }

  static setWinnerPortraitsEnabled(client, guildId, enabled) {
    if (!client?.writeSettings) {
      throw new Error("Guild settings storage is not available.");
    }
    const on = Boolean(enabled);
    client.writeSettings(String(guildId), {
      [WINNER_PORTRAITS_ENABLED]: on ? "true" : "false",
    });
    return on;
  }

  static winnerPortraitsStatusLine(enabled) {
    return enabled
      ? "Winner portraits: on (`/game winner` generates a crowned Gemini portrait)"
      : "Winner portraits: off";
  }
}

module.exports = GuildConfig;
