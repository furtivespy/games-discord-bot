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
  flexible: {
    key: "flexible",
    label: "Flexibly interested",
    confirm:
      "Flexibly interested — you're in, but you'll give your seat to a new player, someone not in a game, or someone who'd rather play",
    header: "Flexible",
    button: "Flexibly interested",
    emoji: "🪑",
    style: ButtonStyle.Secondary,
  },
};

const LEVEL_ORDER = ["very", "somewhat", "flexible"];
// v1 stored "little" (Only a little interested). Keep those people on the
// roster by folding them into somewhat; old gather:little: buttons still parse.
const LEGACY_LEVEL_MAP = {
  little: "somewhat",
};
const FLEXIBLE_MEANING =
  "Flexibly interested: you're in, but you'll give your seat to a new player, someone not in a game, or someone who'd rather play.";
const MAX_DESCRIPTION = 4096;

const locks = new Map();

class GatherInterest {
  static COLLECTION = COLLECTION;
  static LEVELS = LEVELS;
  static LEVEL_ORDER = LEVEL_ORDER;
  static LEGACY_LEVEL_MAP = LEGACY_LEVEL_MAP;
  static FLEXIBLE_MEANING = FLEXIBLE_MEANING;

  static canonicalizeLevel(level) {
    if (level == null) return null;
    const mapped = LEGACY_LEVEL_MAP[level] || level;
    return LEVELS[mapped] ? mapped : null;
  }

  static normalizeGather(gather) {
    if (!gather) return gather;
    if (!gather.status) gather.status = "open";
    if (!Array.isArray(gather.seatedUserIds)) gather.seatedUserIds = [];
    if (!gather.seatedDisplayNames || typeof gather.seatedDisplayNames !== "object") {
      gather.seatedDisplayNames = {};
    }
    if (gather.startedThreadId === undefined) gather.startedThreadId = null;
    if (gather.startedGameId === undefined) gather.startedGameId = null;
    if (gather.startedAt === undefined) gather.startedAt = null;
    if (!gather.interests) return gather;
    for (const entry of Object.values(gather.interests)) {
      const next = this.canonicalizeLevel(entry.level);
      if (next) {
        entry.level = next;
      }
    }
    return gather;
  }

  static isGatherButton(customId) {
    return typeof customId === "string" && customId.startsWith(`${CUSTOM_ID_PREFIX}:`);
  }

  static parseCustomId(customId) {
    if (!this.isGatherButton(customId)) return null;
    const parts = customId.split(":");
    if (parts.length !== 3 || parts[0] !== CUSTOM_ID_PREFIX) return null;
    const [, action, gatherId] = parts;
    if (!gatherId) return null;
    if (action === "close" || action === "reopen" || action === "start") {
      return { action, gatherId };
    }
    const level = this.canonicalizeLevel(action);
    if (level) {
      return { action: "interest", level, gatherId };
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

  static startCustomId(gatherId) {
    return `${CUSTOM_ID_PREFIX}:start:${gatherId}`;
  }

  static seatsCustomId(gatherId) {
    return `${CUSTOM_ID_PREFIX}:seats:${gatherId}`;
  }

  static anyoneCustomId(gatherId) {
    return `${CUSTOM_ID_PREFIX}:anyone:${gatherId}`;
  }

  static confirmSeatsCustomId(gatherId) {
    return `${CUSTOM_ID_PREFIX}:confirm:${gatherId}`;
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
      startedAt: null,
      startedThreadId: null,
      startedGameId: null,
      seatedUserIds: [],
      seatedDisplayNames: {},
      game: { ...game },
      interests: {},
    };
  }

  static upsertInterest(gather, userId, level, displayName, now = new Date()) {
    const canonical = this.canonicalizeLevel(level);
    if (!canonical) {
      throw new Error(`Unknown interest level: ${level}`);
    }
    const updatedAt = now instanceof Date ? now.toISOString() : String(now);
    gather.interests[String(userId)] = {
      level: canonical,
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

  static isStarted(gather) {
    return gather?.status === "started";
  }

  static markStarted(gather, { threadId, gameId, seatedUserIds, seatedDisplayNames, now = new Date() }) {
    const updatedAt = now instanceof Date ? now.toISOString() : String(now);
    gather.status = "started";
    gather.updatedAt = updatedAt;
    gather.startedAt = updatedAt;
    gather.startedThreadId = threadId != null ? String(threadId) : null;
    gather.startedGameId = gameId != null ? String(gameId) : null;
    gather.seatedUserIds = (seatedUserIds || []).map(String);
    gather.seatedDisplayNames = seatedDisplayNames && typeof seatedDisplayNames === "object"
      ? { ...seatedDisplayNames }
      : {};
    return gather;
  }

  static isHost(gather, userId) {
    return String(gather?.hostUserId) === String(userId);
  }

  static countByLevel(gather) {
    const counts = {};
    for (const key of LEVEL_ORDER) counts[key] = 0;
    for (const entry of Object.values(gather?.interests || {})) {
      const level = this.canonicalizeLevel(entry.level);
      if (level) counts[level] += 1;
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
    const groups = {};
    for (const key of LEVEL_ORDER) groups[key] = [];
    for (const [userId, entry] of Object.entries(gather?.interests || {})) {
      const level = this.canonicalizeLevel(entry.level);
      if (!groups[level]) continue;
      groups[level].push({
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

  static interestedSorted(gather) {
    const groups = this.rosterGroups(gather);
    const people = [];
    for (const key of LEVEL_ORDER) {
      for (const person of groups[key]) {
        people.push({ ...person, level: key });
      }
    }
    return people;
  }

  static DISCORD_SELECT_LIMIT = 25;

  static defaultSeatCount(gather, interestedCount) {
    const available = Math.max(0, Number(interestedCount) || 0);
    const max = gather.game?.maxPlayers;
    if (max != null && Number(max) > 0) {
      return Math.max(1, Math.min(Number(max), available, this.DISCORD_SELECT_LIMIT));
    }
    return Math.max(1, Math.min(available, this.DISCORD_SELECT_LIMIT));
  }

  static seatOptionLabel(person) {
    const tag = LEVELS[person.level]?.header || person.level;
    const suffix = ` · ${tag}`;
    let name = person.displayName || `User ${person.userId}`;
    name = name.replace(/[\r\n]+/g, " ").trim() || `User ${person.userId}`;
    const maxName = Math.max(1, 100 - suffix.length);
    if (name.length > maxName) {
      name = `${name.slice(0, Math.max(1, maxName - 1))}…`;
    }
    return `${name}${suffix}`.slice(0, 100);
  }

  static buildSeatSelectOptions(gather) {
    const people = this.interestedSorted(gather);
    const truncated = people.length > this.DISCORD_SELECT_LIMIT;
    const shownPeople = people.slice(0, this.DISCORD_SELECT_LIMIT);
    return {
      options: shownPeople.map((person) => ({
        label: this.seatOptionLabel(person),
        value: String(person.userId),
      })),
      truncated,
      total: people.length,
      shown: shownPeople.length,
    };
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

  static seatedDisplayName(gather, userId) {
    return gather.interests?.[userId]?.displayName
      || gather.seatedDisplayNames?.[userId]
      || `User ${userId}`;
  }

  static buildCurrentlyPlayingBlock(gather) {
    const seatedLines = (gather.seatedUserIds || []).map((userId) => {
      return `• ${this.formatPerson(userId, this.seatedDisplayName(gather, userId))}`;
    });
    const seatedBlock =
      seatedLines.length > 0 ? seatedLines.join("\n") : "(none recorded)";
    return `**Currently Playing**\n${seatedBlock}`;
  }

  static buildInterestSection(gather) {
    const header = this.headerCounts(gather);
    const roster = this.buildRosterText(gather);
    return `**Interest**\n**${header}**\n${FLEXIBLE_MEANING}\n\n${roster}`;
  }

  static buildPanelDescription(gather) {
    const game = gather.game || {};
    const title = game.url ? `[${game.name}](${game.url})` : (game.name || "Unknown game");
    const summary = this.gameSummaryLine(game);
    const hostLine = `Host: ${this.formatPerson(gather.hostUserId, gather.hostDisplayName)}`;
    let description;
    if (this.isStarted(gather)) {
      const jump = gather.startedThreadId
        ? `\nJump to the game: <#${gather.startedThreadId}>`
        : "";
      description = `${title}${summary ? `\n${summary}` : ""}\n${hostLine}\n\n**Game Started**${jump}\n\n${this.buildCurrentlyPlayingBlock(gather)}\n\n${this.buildInterestSection(gather)}`;
    } else {
      const statusLine = this.isOpen(gather)
        ? "Click a button to register. Clicking again updates your level."
        : "**Interest is closed.** The list is frozen.";
      const header = this.headerCounts(gather);
      const roster = this.buildRosterText(gather);
      description = `${title}${summary ? `\n${summary}` : ""}\n${hostLine}\n\n**${header}**\n${statusLine}\n${FLEXIBLE_MEANING}\n\n${roster}`;
    }
    if (description.length > MAX_DESCRIPTION) {
      description = `${description.substring(0, MAX_DESCRIPTION - 3)}...`;
    }
    return description;
  }

  static buildPanelEmbed(gather) {
    const game = gather.game || {};
    const started = this.isStarted(gather);
    const open = this.isOpen(gather);
    const embed = new EmbedBuilder()
      .setTitle(
        started
          ? "Game started"
          : open
            ? "Who's interested?"
            : "Who's interested? (closed)"
      )
      .setDescription(this.buildPanelDescription(gather))
      .setColor(started ? 0x3498db : open ? 0x2ecc71 : 0x95a5a6)
      .setFooter({
        text: started
          ? "Game started · interest is locked"
          : open
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
    const started = this.isStarted(gather);
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
    if (started) {
      if (gather.startedThreadId && gather.guildId) {
        hostRow.addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Jump to game")
            .setEmoji("🎲")
            .setURL(
              `https://discord.com/channels/${gather.guildId}/${gather.startedThreadId}`
            )
        );
      }
    } else {
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
      hostRow.addComponents(
        new ButtonBuilder()
          .setCustomId(this.startCustomId(gather.id))
          .setLabel("Start game")
          .setEmoji("🎲")
          .setStyle(ButtonStyle.Success)
      );
    }

    return hostRow.components.length > 0 ? [interestRow, hostRow] : [interestRow];
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
    return this.normalizeGather(data);
  }

  static async saveGather(client, gather) {
    this.normalizeGather(gather);
    await client.setGameDataV2(gather.guildId, COLLECTION, gather.id, gather);
  }

  /**
   * Persist message ids after the panel is live without clobbering
   * interests (or status) written by a concurrent button click.
   */
  static async saveGatherAfterPost(client, posted) {
    return this.withGatherLock(posted.id, async () => {
      const latest = (await this.loadGather(client, posted.guildId, posted.id)) || posted;
      if (posted.gameMessageId != null) {
        latest.gameMessageId = posted.gameMessageId;
      }
      if (posted.interestMessageId != null) {
        latest.interestMessageId = posted.interestMessageId;
      }
      await this.saveGather(client, latest);
      return latest;
    });
  }

  static async withGatherLock(gatherId, fn) {
    const previous = locks.get(gatherId) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    // Store the same promise we compare on release so the last waiter
    // can delete the map entry. previous.then(() => current) must be
    // the stored value — not `current` itself.
    const queued = previous.then(() => current);
    locks.set(gatherId, queued);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (locks.get(gatherId) === queued) {
        locks.delete(gatherId);
      }
    }
  }

  static hasActiveLock(gatherId) {
    return locks.has(gatherId);
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

    if (parsed.action === "start") {
      return this.handleStartButton(interaction, client, parsed.gatherId);
    }

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
        if (this.isStarted(gather)) {
          await this.replyEphemeral(interaction, "This gather already started a game.");
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
        if (this.isStarted(gather)) {
          await this.replyEphemeral(
            interaction,
            "This gather already started a game. Interest can't be re-opened."
          );
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

  static async handleStartButton(interaction, client, gatherId) {
    const GatherStartGame = require("./GatherStartGame");
    const preview = await this.withGatherLock(gatherId, async () => {
      const gather = await this.loadGather(client, interaction.guildId, gatherId);
      const error = GatherStartGame.startPreconditionsError(
        gather,
        interaction.user.id,
        client,
        interaction.guild
      );
      if (error) return { error };
      return { gather };
    });
    if (preview.error) {
      await this.replyEphemeral(interaction, preview.error);
      return true;
    }
    await GatherStartGame.promptAndStart(interaction, client, preview.gather);
    return true;
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
