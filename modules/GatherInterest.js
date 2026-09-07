const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { nanoid } = require("nanoid");

const COLLECTION = "gather";
const CUSTOM_ID_PREFIX = "gather";

const LEVELS = {
  very: {
    key: "very",
    label: "Very interested",
    confirm: "Very interested",
    header: "Very",
    button: "Very interested",
    emoji: "🔥",
    style: ButtonStyle.Success,
  },
  somewhat: {
    key: "somewhat",
    label: "Somewhat interested",
    confirm: "Somewhat interested",
    header: "Somewhat",
    button: "Somewhat interested",
    emoji: "👍",
    style: ButtonStyle.Primary,
  },
  little: {
    key: "little",
    label: "Only a little interested",
    confirm: "Only a little interested",
    header: "Little",
    button: "Only a little",
    emoji: "🤏",
    style: ButtonStyle.Secondary,
  },
  flexible: {
    key: "flexible",
    label: "Give my spot away",
    confirm: "Give my spot away",
    header: "Flexible",
    button: "Give my spot away",
    emoji: "🪑",
    style: ButtonStyle.Secondary,
  },
};

const LEVEL_ORDER = ["very", "somewhat", "little", "flexible"];
const MAX_DESCRIPTION = 4096;

const locks = new Map();

class GatherInterest {
  static COLLECTION = COLLECTION;
  static LEVELS = LEVELS;
  static LEVEL_ORDER = LEVEL_ORDER;

  static isGatherButton(customId) {
    return typeof customId === "string" && customId.startsWith(`${CUSTOM_ID_PREFIX}:`);
  }

  static parseCustomId(customId) {
    if (!this.isGatherButton(customId)) return null;
    const parts = customId.split(":");
    if (parts.length !== 3 || parts[0] !== CUSTOM_ID_PREFIX) return null;
    const [, action, gatherId] = parts;
    if (!gatherId) return null;
    if (action === "close" || action === "reopen") {
      return { action, gatherId };
    }
    if (LEVELS[action]) {
      return { action: "interest", level: action, gatherId };
    }
    return null;
  }

  static interestCustomId(gatherId, level) {
    return `${CUSTOM_ID_PREFIX}:${level}:${gatherId}`;
  }

  static closeCustomId(gatherId) {
    return `${CUSTOM_ID_PREFIX}:close:${gatherId}`;
  }

  static reopenCustomId(gatherId) {
    return `${CUSTOM_ID_PREFIX}:reopen:${gatherId}`;
  }

  static snapshotFromBgg(bgg) {
    const info = bgg?.gameInfo || {};
    const gameId = bgg?.gameId;
    return {
      bggId: gameId != null ? String(gameId) : "",
      name: bgg?.gameName || "Unknown game",
      image: info.image || null,
      minPlayers: info.minplayers ?? null,
      maxPlayers: info.maxplayers ?? null,
      minPlaytime: info.minplaytime ?? null,
      maxPlaytime: info.maxplaytime ?? null,
      weight: info.statistics?.ratings?.averageweight ?? null,
      yearPublished: info.yearpublished ?? null,
      url: gameId != null ? `https://boardgamegeek.com/boardgame/${gameId}` : null,
    };
  }

  static createGather({
    guildId,
    channelId,
    hostUserId,
    hostDisplayName,
    game,
    now = new Date(),
  }) {
    const createdAt = now instanceof Date ? now.toISOString() : String(now);
    return {
      id: nanoid(),
      kind: "gather",
      guildId: String(guildId),
      channelId: String(channelId),
      gameMessageId: null,
      interestMessageId: null,
      hostUserId: String(hostUserId),
      hostDisplayName: hostDisplayName || "Host",
      status: "open",
      createdAt,
      closedAt: null,
      updatedAt: createdAt,
      game: { ...game },
      interests: {},
    };
  }

  static upsertInterest(gather, userId, level, displayName, now = new Date()) {
    if (!LEVELS[level]) {
      throw new Error(`Unknown interest level: ${level}`);
    }
    const updatedAt = now instanceof Date ? now.toISOString() : String(now);
    gather.interests[String(userId)] = {
      level,
      displayName: displayName || `User ${userId}`,
      updatedAt,
    };
    gather.updatedAt = updatedAt;
    return gather;
  }

  static setStatus(gather, status, now = new Date()) {
    const updatedAt = now instanceof Date ? now.toISOString() : String(now);
    gather.status = status;
    gather.updatedAt = updatedAt;
    gather.closedAt = status === "closed" ? updatedAt : null;
    return gather;
  }

  static isOpen(gather) {
    return gather?.status === "open";
  }

  static isHost(gather, userId) {
    return String(gather?.hostUserId) === String(userId);
  }

  static countByLevel(gather) {
    const counts = { very: 0, somewhat: 0, little: 0, flexible: 0 };
    for (const entry of Object.values(gather?.interests || {})) {
      if (counts[entry.level] !== undefined) {
        counts[entry.level] += 1;
      }
    }
    return counts;
  }

  static headerCounts(gather) {
    const counts = this.countByLevel(gather);
    return LEVEL_ORDER.map(
      (key) => `${LEVELS[key].header}: ${counts[key]}`
    ).join(" · ");
  }

  static formatPerson(userId, displayName) {
    const name = displayName || `User ${userId}`;
    return `${name} · <@${userId}>`;
  }

  static rosterGroups(gather) {
    const groups = {
      very: [],
      somewhat: [],
      little: [],
      flexible: [],
    };
    for (const [userId, entry] of Object.entries(gather?.interests || {})) {
      if (!groups[entry.level]) continue;
      groups[entry.level].push({
        userId,
        displayName: entry.displayName,
        updatedAt: entry.updatedAt,
      });
    }
    for (const key of LEVEL_ORDER) {
      groups[key].sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
    }
    return groups;
  }

  static buildRosterText(gather) {
    const groups = this.rosterGroups(gather);
    const sections = [];
    for (const key of LEVEL_ORDER) {
      const people = groups[key];
      if (people.length === 0) continue;
      const lines = people.map((person) => `• ${this.formatPerson(person.userId, person.displayName)}`);
      sections.push(`**${LEVELS[key].label}**\n${lines.join("\n")}`);
    }
    if (sections.length === 0) {
      return "No one has registered yet. Click a button to add yourself.";
    }
    return sections.join("\n\n");
  }

  static gameSummaryLine(game = {}) {
    const bits = [];
    if (game.minPlayers != null || game.maxPlayers != null) {
      bits.push(`${game.minPlayers ?? "?"}–${game.maxPlayers ?? "?"} players`);
    }
    if (game.minPlaytime != null || game.maxPlaytime != null) {
      bits.push(`${game.minPlaytime ?? "?"}–${game.maxPlaytime ?? "?"} min`);
    }
    if (game.weight != null && game.weight !== "") {
      bits.push(`weight ${game.weight}`);
    }
    return bits.join(" · ");
  }

  static buildPanelDescription(gather) {
    const game = gather.game || {};
    const title = game.url ? `[${game.name}](${game.url})` : (game.name || "Unknown game");
    const summary = this.gameSummaryLine(game);
    const hostLine = `Host: ${this.formatPerson(gather.hostUserId, gather.hostDisplayName)}`;
    const statusLine = this.isOpen(gather)
      ? "Click a button to register. Clicking again updates your level."
      : "**Interest is closed.** The list is frozen.";
    const header = this.headerCounts(gather);
    const roster = this.buildRosterText(gather);

    let description = `${title}${summary ? `\n${summary}` : ""}\n${hostLine}\n\n**${header}**\n${statusLine}\n\n${roster}`;
    if (description.length > MAX_DESCRIPTION) {
      description = `${description.substring(0, MAX_DESCRIPTION - 3)}...`;
    }
    return description;
  }

  static buildPanelEmbed(gather) {
    const game = gather.game || {};
    const embed = new EmbedBuilder()
      .setTitle(this.isOpen(gather) ? "Who's interested?" : "Who's interested? (closed)")
      .setDescription(this.buildPanelDescription(gather))
      .setColor(this.isOpen(gather) ? 0x2ecc71 : 0x95a5a6)
      .setFooter({
        text: this.isOpen(gather)
          ? "Latest click wins · same level keeps you registered"
          : "Host closed interest · list is frozen",
      });
    if (game.image) {
      embed.setThumbnail(game.image);
    }
    if (game.url) {
      embed.setURL(game.url);
    }
    return embed;
  }

  static buildPanelComponents(gather) {
    const closed = !this.isOpen(gather);
    const interestRow = new ActionRowBuilder();
    for (const key of LEVEL_ORDER) {
      const level = LEVELS[key];
      interestRow.addComponents(
        new ButtonBuilder()
          .setCustomId(this.interestCustomId(gather.id, key))
          .setLabel(level.button)
          .setEmoji(level.emoji)
          .setStyle(level.style)
          .setDisabled(closed)
      );
    }

    const hostRow = new ActionRowBuilder();
    if (closed) {
      hostRow.addComponents(
        new ButtonBuilder()
          .setCustomId(this.reopenCustomId(gather.id))
          .setLabel("Re-open interest")
          .setEmoji("🔓")
          .setStyle(ButtonStyle.Primary)
      );
    } else {
      hostRow.addComponents(
        new ButtonBuilder()
          .setCustomId(this.closeCustomId(gather.id))
          .setLabel("Close interest")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );
    }

    return [interestRow, hostRow];
  }

  static buildPanelPayload(gather) {
    return {
      embeds: [this.buildPanelEmbed(gather)],
      components: this.buildPanelComponents(gather),
      allowedMentions: { parse: [] },
    };
  }

  static async loadGather(client, guildId, gatherId) {
    const data = await client.getGameDataV2(guildId, COLLECTION, gatherId);
    if (!data || data.kind !== "gather" || !data.id) {
      return null;
    }
    return data;
  }

  static async saveGather(client, gather) {
    await client.setGameDataV2(gather.guildId, COLLECTION, gather.id, gather);
  }

  static async withGatherLock(gatherId, fn) {
    const previous = locks.get(gatherId) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    locks.set(gatherId, previous.then(() => current));
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (locks.get(gatherId) === current) {
        locks.delete(gatherId);
      }
    }
  }

  static async replyEphemeral(interaction, content) {
    const payload = { content, flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(payload);
    }
    return interaction.reply(payload);
  }

  static async handleButton(interaction, client) {
    const parsed = this.parseCustomId(interaction.customId);
    if (!parsed) return false;

    if (!interaction.guildId) {
      await this.replyEphemeral(interaction, "Gathers only work in a server channel.");
      return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    return this.withGatherLock(parsed.gatherId, async () => {
      const gather = await this.loadGather(client, interaction.guildId, parsed.gatherId);
      if (!gather) {
        await this.replyEphemeral(interaction, "This gather is no longer available.");
        return true;
      }

      const displayName = interaction.member?.displayName || interaction.user.username;

      if (parsed.action === "interest") {
        if (!this.isOpen(gather)) {
          await this.replyEphemeral(interaction, "Interest is closed for this gather.");
          return true;
        }
        this.upsertInterest(gather, interaction.user.id, parsed.level, displayName);
        await this.saveGather(client, gather);
        await this.editPanel(interaction, gather);
        await this.replyEphemeral(
          interaction,
          `Registered: ${LEVELS[parsed.level].confirm}`
        );
        return true;
      }

      if (parsed.action === "close") {
        if (!this.isHost(gather, interaction.user.id)) {
          await this.replyEphemeral(interaction, "Only the host can close interest.");
          return true;
        }
        if (!this.isOpen(gather)) {
          await this.replyEphemeral(interaction, "Interest is already closed.");
          return true;
        }
        this.setStatus(gather, "closed");
        await this.saveGather(client, gather);
        await this.editPanel(interaction, gather);
        await this.replyEphemeral(interaction, "Interest closed. The list is frozen.");
        return true;
      }

      if (parsed.action === "reopen") {
        if (!this.isHost(gather, interaction.user.id)) {
          await this.replyEphemeral(interaction, "Only the host can re-open interest.");
          return true;
        }
        if (this.isOpen(gather)) {
          await this.replyEphemeral(interaction, "Interest is already open.");
          return true;
        }
        this.setStatus(gather, "open");
        await this.saveGather(client, gather);
        await this.editPanel(interaction, gather);
        await this.replyEphemeral(interaction, "Interest re-opened. People can register again.");
        return true;
      }

      await this.replyEphemeral(interaction, "Unknown gather action.");
      return true;
    });
  }

  static async editPanel(interaction, gather) {
    const payload = this.buildPanelPayload(gather);
    try {
      await interaction.message.edit(payload);
    } catch (error) {
      const channel = interaction.channel;
      if (!channel || !gather.interestMessageId) throw error;
      const message = await channel.messages.fetch(gather.interestMessageId);
      await message.edit(payload);
    }
  }
}

module.exports = GatherInterest;
