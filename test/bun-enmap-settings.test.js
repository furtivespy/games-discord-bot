const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const onChange = require("on-change");
const BunEnmap = require("../modules/BunEnmap.js");
const GuildConfig = require("../modules/GuildConfig.js");

function withTempDataDir(run) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bun-enmap-"));
  const previousDataDir = process.env.GAMEBOT_DATA_DIR;
  process.env.GAMEBOT_DATA_DIR = dataDir;
  try {
    return run(dataDir);
  } finally {
    if (previousDataDir === undefined) {
      delete process.env.GAMEBOT_DATA_DIR;
    } else {
      process.env.GAMEBOT_DATA_DIR = previousDataDir;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

function watchedDefaults(defaults = { prefix: "!", winner_portraits_enabled: "true" }) {
  return onChange({ defaultSettings: { ...defaults } }, () => {}).defaultSettings;
}

// Mirrors DiscordBot.getSettings (ready handler seeds "default" from config).
function getSettings(client, guild) {
  client.settings.ensure("default", client.config.defaultSettings);
  if (!guild) return client.settings.get("default");
  const guildConf = client.settings.get(guild.id) || {};
  return { ...client.settings.get("default"), ...guildConf };
}

describe("BunEnmap cloneLevel deep with on-change Proxies", () => {
  test("set of an on-change Proxy can be get() without DataCloneError", () => {
    withTempDataDir(() => {
      const settings = new BunEnmap({ name: "settings", cloneLevel: "deep" });
      const defaultSettings = watchedDefaults();

      expect(() => structuredClone(defaultSettings)).toThrow(
        /can not be cloned/i
      );

      settings.set("default", defaultSettings);

      let stored;
      expect(() => {
        stored = settings.get("default");
      }).not.toThrow();
      expect(stored).toEqual({ prefix: "!", winner_portraits_enabled: "true" });
      expect(() => structuredClone(stored)).not.toThrow();
    });
  });

  test("fresh data dir: ready-handler set then getSettings works without restart", () => {
    withTempDataDir(() => {
      const settings = new BunEnmap({ name: "settings", cloneLevel: "deep" });
      const config = { defaultSettings: watchedDefaults() };
      const client = {
        settings,
        config,
        getSettings(guild) {
          return getSettings(this, guild);
        },
      };

      expect(settings.has("default")).toBe(false);
      if (!client.settings.has("default")) {
        client.settings.set("default", client.config.defaultSettings);
      }

      const merged = client.getSettings({ id: "guild-1" });
      expect(merged.prefix).toBe("!");
      expect(GuildConfig.isWinnerPortraitsEnabled(client, { id: "guild-1" })).toBe(
        true
      );
    });
  });

  test("ensure seeds an on-change Proxy default on a missing key", () => {
    withTempDataDir(() => {
      const settings = new BunEnmap({ name: "settings", cloneLevel: "deep" });
      const defaultSettings = watchedDefaults({
        prefix: "?",
        winner_portraits_enabled: "true",
      });

      const seeded = settings.ensure("default", defaultSettings);
      expect(seeded).toEqual({ prefix: "?", winner_portraits_enabled: "true" });
      expect(settings.get("default")).toEqual(seeded);
    });
  });

  test("persisted JSON reloads as a plain object after a new BunEnmap open", () => {
    withTempDataDir(() => {
      const first = new BunEnmap({ name: "settings", cloneLevel: "deep" });
      first.set(
        "default",
        watchedDefaults({ prefix: ">>", winner_portraits_enabled: "true" })
      );
      expect(first.get("default").prefix).toBe(">>");

      const second = new BunEnmap({ name: "settings", cloneLevel: "deep" });
      expect(second.get("default")).toEqual({
        prefix: ">>",
        winner_portraits_enabled: "true",
      });
      expect(() => structuredClone(second.get("default"))).not.toThrow();
    });
  });

  test("deep clone on set isolates later mutations of the original object", () => {
    withTempDataDir(() => {
      const settings = new BunEnmap({ name: "settings", cloneLevel: "deep" });
      const original = { prefix: "!" };
      settings.set("default", original);
      original.prefix = "changed";
      expect(settings.get("default").prefix).toBe("!");
    });
  });
});
