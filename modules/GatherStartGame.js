const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  StringSelectMenuBuilder,
  ThreadAutoArchiveDuration,
  UserSelectMenuBuilder,
} = require("discord.js");
const { cloneDeep, shuffle } = require("lodash");
const GatherInterest = require("./GatherInterest");
const GameIdentity = require("./GameIdentity");
const GuildConfig = require("./GuildConfig");

class GatherStartGame {
  static SELECT_TIMEOUT_MS = 120000;

  static threadNameFromGame(name) {
    const cleaned = String(name || "Game").replace(/[\r\n]+/g, " ").trim() || "Game";
    return cleaned.slice(0, 100);
  }

  static jumpUrl(guildId, channelId, messageId = null) {
    const base = `https://discord.com/channels/${guildId}/${channelId}`;
    return messageId ? `${base}/${messageId}` : base;
  }

  static seatCountWarnings(gather, seatedCount) {
    const warnings = [];
    const min = gather.game?.minPlayers;
    const max = gather.game?.maxPlayers;
    if (min != null && Number(min) > 0 && seatedCount < Number(min)) {
      warnings.push(
        `BGG lists a minimum of ${min} players; you seated ${seatedCount}.`
      );
    }
    if (max != null && Number(max) > 0 && seatedCount > Number(max)) {
      warnings.push(
        `BGG lists a maximum of ${max} players; you seated ${seatedCount}.`
      );
    }
    return warnings;
  }

  static asIdList(values) {
    if (!Array.isArray(values)) return [];
    return values.map(String).filter(Boolean);
  }

  static uniqueIds(ids) {
    const seen = new Set();
    const out = [];
    for (const id of this.asIdList(ids)) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  static mergeSeatSelections(interestedIds, anyoneIds) {
    return this.uniqueIds([...this.asIdList(interestedIds), ...this.asIdList(anyoneIds)]);
  }

  static ensureHostSeated(seatedIds, hostUserId) {
    const hostId = hostUserId != null ? String(hostUserId) : "";
    if (!hostId) return this.uniqueIds(seatedIds);
    return this.uniqueIds([hostId, ...this.asIdList(seatedIds)]);
  }

  static formatSelectedLine(interestedIds, anyoneIds) {
    const seated = this.mergeSeatSelections(interestedIds, anyoneIds);
    if (seated.length === 0) return "Currently selected: (none yet)";
    return `Currently selected (${seated.length}): ${seated.map((id) => `<@${id}>`).join(" ")}`;
  }

  static memberDisplayNames(guild, userIds) {
    const names = {};
    const cache = guild?.members?.cache;
    if (!cache) return names;
    for (const id of this.asIdList(userIds)) {
      const member =
        typeof cache.get === "function" ? cache.get(id) : cache[id];
      if (!member) continue;
      names[id] =
        member.displayName || member.user?.username || member.username || `User ${id}`;
    }
    return names;
  }

  static resolveSeatedPeople(gather, seatedIds, extraNames = {}) {
    const interested = new Map(
      GatherInterest.interestedSorted(gather).map((person) => [
        String(person.userId),
        person,
      ])
    );
    const seated = [];
    for (const id of this.uniqueIds(seatedIds)) {
      const person = interested.get(id);
      if (person) {
        seated.push(person);
        continue;
      }
      seated.push({
        userId: id,
        displayName: extraNames[id] || `User ${id}`,
        level: null,
      });
    }
    return seated;
  }

  static seatedDisplayNameMap(seated) {
    const names = {};
    for (const person of seated) {
      if (person?.userId) {
        names[String(person.userId)] =
          person.displayName || `User ${person.userId}`;
      }
    }
    return names;
  }

  static buildPickerContent(gather, selectMeta, selection = {}) {
    const gameName = GatherInterest.gameDisplayName(gather);
    const custom = GatherInterest.isCustomGather(gather);
    const min = gather.game?.minPlayers;
    const max = gather.game?.maxPlayers;
    const range =
      !custom && (min != null || max != null)
        ? `BGG player count: ${min ?? "?"}–${max ?? "?"}. `
        : "";
    const seatingNote = custom
      ? "Pick from people who showed interest and/or any other member of this server. Both lists are combined."
      : `${range}Pick from people who showed interest and/or any other member of this server. Both lists are combined. Seating outside the BGG min/max is allowed (you'll get a warning).`;
    const lines = [
      `Select who sits for **${gameName}**.`,
      seatingNote,
    ];
    if (selectMeta.hasInterested) {
      lines.push(
        `Interested list: choose 0–${selectMeta.maxValues} (Very → Somewhat → Flexibly).`
      );
    }
    lines.push(
      `Server members: searchable picker, up to ${GatherInterest.DISCORD_SELECT_LIMIT}. Then click **Start with these seats**. The host is always seated.`
    );
    if (selectMeta.truncated) {
      lines.push(
        `Showing the top ${selectMeta.shown} of ${selectMeta.total} interested. Use the server member picker for anyone else, including people not on that list.`
      );
    }
    if (!selectMeta.hasInterested) {
      lines.push("Nobody has logged interest yet — pick players from the server list.");
    }
    lines.push(
      this.formatSelectedLine(selection.interestedIds, selection.anyoneIds)
    );
    return lines.join("\n");
  }

  static buildSeatSelectRow(gather) {
    const { options, truncated, total, shown } =
      GatherInterest.buildSeatSelectOptions(gather);
    if (options.length < 1) {
      return {
        row: null,
        truncated: false,
        total: 0,
        shown: 0,
        maxValues: 0,
        hasInterested: false,
      };
    }
    // Spec: warn outside BGG min/max rather than hard-blocking over-max via maxValues.
    const maxValues = Math.max(
      1,
      Math.min(options.length, GatherInterest.DISCORD_SELECT_LIMIT)
    );
    const select = new StringSelectMenuBuilder()
      .setCustomId(GatherInterest.seatsCustomId(gather.id))
      .setPlaceholder("Interested players")
      .setMinValues(0)
      .setMaxValues(maxValues)
      .addOptions(options);
    return {
      row: new ActionRowBuilder().addComponents(select),
      truncated,
      total,
      shown,
      maxValues,
      hasInterested: true,
    };
  }

  static buildAnyoneSelectRow(gather) {
    const select = new UserSelectMenuBuilder()
      .setCustomId(GatherInterest.anyoneCustomId(gather.id))
      .setPlaceholder("Anyone on this server")
      .setMinValues(0)
      .setMaxValues(GatherInterest.DISCORD_SELECT_LIMIT);
    return new ActionRowBuilder().addComponents(select);
  }

  static buildConfirmRow(gather) {
    const button = new ButtonBuilder()
      .setCustomId(GatherInterest.confirmSeatsCustomId(gather.id))
      .setLabel("Start with these seats")
      .setEmoji("🎲")
      .setStyle(ButtonStyle.Success);
    return new ActionRowBuilder().addComponents(button);
  }

  static buildSeatPickerComponents(gather) {
    const interested = this.buildSeatSelectRow(gather);
    const rows = [];
    if (interested.row) rows.push(interested.row);
    rows.push(this.buildAnyoneSelectRow(gather));
    rows.push(this.buildConfirmRow(gather));
    return rows;
  }

  static startPreconditionsError(gather, userId, client, guild) {
    if (!gather) return "This gather is no longer available.";
    if (!GatherInterest.isHost(gather, userId)) {
      return "Only the host can start the game.";
    }
    if (GatherInterest.isStarted(gather)) {
      const jump = gather.startedThreadId
        ? ` Jump to the game: <#${gather.startedThreadId}>`
        : "";
      return `This gather already started a game.${jump}`;
    }
    if (!GuildConfig.getLfgGameParentChannelId(client, guild)) {
      return GuildConfig.unsetStartMessage();
    }
    return null;
  }

  static isForumLikeParent(channel) {
    const type = channel?.type;
    return (
      type === ChannelType.GuildForum ||
      (ChannelType.GuildMedia != null && type === ChannelType.GuildMedia)
    );
  }

  static canCreatePlayThread(channel) {
    if (!channel || typeof channel.threads?.create !== "function") return false;
    if (typeof channel.isThread === "function" && channel.isThread()) return false;
    return true;
  }

  static parentChannelError(channel) {
    if (!channel) {
      return "The configured games channel is missing or I can't see it. An administrator should run `/config games-channel` again.";
    }
    if (!this.canCreatePlayThread(channel)) {
      return "The games channel must be a text or forum channel that can have threads (not a voice channel or an existing thread). An administrator can pick a different channel with `/config games-channel`.";
    }
    return null;
  }

  static buildThreadCreateOptions(gather, parent) {
    const gameName = GatherInterest.gameDisplayName(gather);
    const options = {
      name: this.threadNameFromGame(gameName),
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: `Game Bot: start from /lfg (${gameName})`,
    };
    if (this.isForumLikeParent(parent)) {
      // Forum/media posts require a starter message; Discord uses that message's
      // id as the thread id, so we seed pinned live status from it after create.
      const GameStatusHelper = require("./GameStatusHelper");
      options.message = {
        content: GameStatusHelper.buildPinnedStatusContent(),
      };
    }
    return options;
  }

  static hostError(message, extra = {}) {
    const error = new Error(message);
    error.hostMessage = message;
    Object.assign(error, extra);
    return error;
  }

  static async fetchGamesParent(client, guild, channelId) {
    try {
      if (typeof client.channels?.fetch === "function") {
        const channel = await client.channels.fetch(channelId);
        if (channel) return channel;
      }
    } catch (error) {
      console.error("Could not fetch games parent channel via client.channels.", error);
    }
    try {
      if (typeof guild?.channels?.fetch === "function") {
        return await guild.channels.fetch(channelId);
      }
    } catch (error) {
      console.error("Could not fetch games parent channel via guild.channels.", error);
    }
    return null;
  }

  static async promptAndStart(interaction, client, gatherSnapshot, deps = {}) {
    if (Array.isArray(deps.selectedUserIds)) {
      return this.confirmStart(
        interaction,
        client,
        gatherSnapshot.id,
        deps.selectedUserIds,
        deps
      );
    }

    const selectMeta = this.buildSeatSelectRow(gatherSnapshot);
    const picker = {
      content: this.buildPickerContent(gatherSnapshot, selectMeta),
      components: this.buildSeatPickerComponents(gatherSnapshot),
    };

    let pickerMessage;
    if (interaction.deferred || interaction.replied) {
      pickerMessage = await interaction.editReply({
        ...picker,
        fetchReply: true,
      });
    } else {
      pickerMessage = await interaction.reply({
        ...picker,
        flags: MessageFlags.Ephemeral,
        fetchReply: true,
      });
    }
    if (!pickerMessage && typeof interaction.fetchReply === "function") {
      pickerMessage = await interaction.fetchReply();
    }

    const seatedIds = await this.collectSeatSelections(
      pickerMessage,
      interaction,
      gatherSnapshot,
      deps
    );
    if (!seatedIds) return false;
    return this.confirmStart(
      interaction,
      client,
      gatherSnapshot.id,
      seatedIds,
      deps
    );
  }

  static pickerCustomIds(gatherId) {
    return [
      GatherInterest.seatsCustomId(gatherId),
      GatherInterest.anyoneCustomId(gatherId),
      GatherInterest.confirmSeatsCustomId(gatherId),
    ];
  }

  static async collectSeatSelections(pickerMessage, interaction, gather, deps = {}) {
    const interestedIds = [];
    const anyoneIds = [];
    const allowedIds = this.pickerCustomIds(gather.id);
    const filter = (component) =>
      component.user.id === interaction.user.id &&
      allowedIds.includes(component.customId);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const createCollector =
        deps.createCollector ||
        ((message, options) => message.createMessageComponentCollector(options));
      const collector = createCollector(pickerMessage, {
        filter,
        time: deps.timeoutMs ?? this.SELECT_TIMEOUT_MS,
      });

      const refreshPicker = async (component, extraLine = null) => {
        const content = [
          this.buildPickerContent(gather, this.buildSeatSelectRow(gather), {
            interestedIds,
            anyoneIds,
          }),
          extraLine,
        ]
          .filter(Boolean)
          .join("\n\n");
        await component.update({
          content,
          components: this.buildSeatPickerComponents(gather),
        });
      };

      collector.on("collect", async (component) => {
        try {
          if (component.customId === GatherInterest.seatsCustomId(gather.id)) {
            interestedIds.splice(
              0,
              interestedIds.length,
              ...this.asIdList(component.values)
            );
            await refreshPicker(component);
            return;
          }
          if (component.customId === GatherInterest.anyoneCustomId(gather.id)) {
            anyoneIds.splice(
              0,
              anyoneIds.length,
              ...this.asIdList(component.values)
            );
            const users = component.users || component.members;
            if (users && typeof users.values === "function") {
              deps.displayNames = { ...(deps.displayNames || {}) };
              for (const user of users.values()) {
                const id = String(user.id || user.user?.id || "");
                if (!id) continue;
                deps.displayNames[id] =
                  user.displayName ||
                  user.globalName ||
                  user.username ||
                  user.user?.username ||
                  `User ${id}`;
              }
            }
            await refreshPicker(component);
            return;
          }
          if (component.customId === GatherInterest.confirmSeatsCustomId(gather.id)) {
            const seatedIds = this.ensureHostSeated(
              this.mergeSeatSelections(interestedIds, anyoneIds),
              gather.hostUserId
            );
            if (seatedIds.length < 1) {
              await refreshPicker(
                component,
                "Select at least one player, then click **Start with these seats**."
              );
              return;
            }
            if (typeof collector.stop === "function") collector.stop("confirmed");
            if (typeof component.deferUpdate === "function") {
              try {
                await component.deferUpdate();
              } catch (_) {
                // Already acknowledged or token expired.
              }
            }
            finish(seatedIds);
          }
        } catch (error) {
          console.error("LFG seat picker interaction failed.", error);
        }
      });

      collector.on("end", async (_collected, reason) => {
        if (reason === "confirmed" || settled) return;
        try {
          await interaction.editReply({
            content: "No players selected. Click **Start game** to try again.",
            components: [],
          });
        } catch (_) {
          // Ephemeral token may already be gone.
        }
        finish(null);
      });
    });
  }

  static async confirmStart(interaction, client, gatherId, seatedIds, deps = {}) {
    return GatherInterest.withGatherLock(gatherId, async () => {
      const gather = await GatherInterest.loadGather(
        client,
        interaction.guildId,
        gatherId
      );
      const pre = this.startPreconditionsError(
        gather,
        interaction.user.id,
        client,
        interaction.guild
      );
      if (pre) {
        await GatherInterest.replyEphemeral(interaction, pre);
        return false;
      }

      const seatedIdsWithHost = this.ensureHostSeated(seatedIds, gather.hostUserId);
      const extraNames = {
        ...(deps.displayNames || {}),
        ...this.memberDisplayNames(interaction.guild, seatedIdsWithHost),
      };
      if (gather.hostUserId && gather.hostDisplayName) {
        const hostId = String(gather.hostUserId);
        if (!extraNames[hostId]) {
          extraNames[hostId] = gather.hostDisplayName;
        }
      }
      const seated = this.resolveSeatedPeople(
        gather,
        seatedIdsWithHost,
        extraNames
      );
      if (seated.length < 1) {
        await GatherInterest.replyEphemeral(
          interaction,
          "Select at least one player. Click **Start game** to try again."
        );
        return false;
      }

      const warnings = this.seatCountWarnings(gather, seated.length);
      try {
        await this.executeStart(
          interaction,
          client,
          gather,
          seated,
          warnings,
          deps
        );
        return true;
      } catch (error) {
        const logger = client.logger?.log?.bind(client.logger) || console.error;
        logger(error, "error");
        const message =
          error?.hostMessage ||
          "Could not start the game. No table was created. Please try again.";
        await GatherInterest.replyEphemeral(interaction, message);
        return false;
      }
    });
  }

  static async executeStart(
    interaction,
    client,
    gather,
    seated,
    warnings,
    deps = {}
  ) {
    const parentId = GuildConfig.getLfgGameParentChannelId(
      client,
      interaction.guild
    );
    if (!parentId) {
      throw this.hostError(GuildConfig.unsetStartMessage());
    }

    const parent = await this.fetchGamesParent(
      client,
      interaction.guild,
      parentId
    );
    const parentError = this.parentChannelError(parent);
    if (parentError) {
      throw this.hostError(parentError);
    }

    const parentGuildId = parent.guildId || parent.guild?.id;
    if (parentGuildId && String(parentGuildId) !== String(gather.guildId)) {
      throw this.hostError(
        "The configured games channel is not in this server. An administrator should run `/config games-channel` again."
      );
    }

    let thread;
    const forumLike = this.isForumLikeParent(parent);
    try {
      thread = await parent.threads.create(
        this.buildThreadCreateOptions(gather, parent)
      );
    } catch (error) {
      console.error("Failed to create game thread for LFG start.", error);
      throw this.hostError(
        forumLike
          ? "I couldn't create a forum post in the games channel. I need permission to create posts and send messages there."
          : "I couldn't create a thread in the games channel. I need permission to create public threads and send messages there."
      );
    }

    try {
      await this.createGameInThread(
        interaction,
        client,
        gather,
        seated,
        thread,
        warnings,
        {
          ...deps,
          // Forum post id === starter message id; reuse it as the pinned status.
          forumStarterMessageId: forumLike ? thread.id : null,
        }
      );
    } catch (error) {
      if (!error.keepThread) {
        if (error.gameCommitted) {
          await this.abandonSavedGame(client, gather.guildId, thread.id);
        }
        await this.abandonThread(thread, client);
      }
      if (error.hostMessage) throw error;
      throw this.hostError(
        "Game create failed after the thread was opened. I cleaned up the thread. Please try again."
      );
    }
  }

  static async abandonThread(thread, client) {
    const log =
      client?.logger?.log?.bind(client.logger) ||
      ((err) => console.error(err));
    try {
      await thread.delete("Game Bot: game create failed after thread create");
      return;
    } catch (error) {
      log(error, "error");
    }
    try {
      const failedName = `[failed] ${thread.name}`.slice(0, 100);
      await thread.setName(failedName);
    } catch (error) {
      log(error, "error");
    }
  }

  static async abandonSavedGame(client, guildId, threadId) {
    try {
      const data = await client.getGameDataV2(guildId, "game", threadId);
      if (data && data.isdeleted === false) {
        data.isdeleted = true;
        await client.setGameDataV2(guildId, "game", threadId, data, {
          skipPinnedRefresh: true,
        });
      }
    } catch (error) {
      console.error(
        "Failed to clear orphan game after LFG start failure.",
        error
      );
    }
  }

  static async createGameInThread(
    interaction,
    client,
    gather,
    seated,
    thread,
    warnings,
    deps = {}
  ) {
    const GameDB = require("../db/anygame.js");
    const GameHelper = require("./GlobalGameHelper");
    const GameStatusHelper = require("./GameStatusHelper");

    const existing = await client.getGameDataV2(
      gather.guildId,
      "game",
      thread.id
    );
    if (existing && existing.isdeleted === false) {
      throw this.hostError(
        "There's already a game in the new thread. I won't overwrite it. Please try again."
      );
    }

    const shuffleFn = deps.shuffle || shuffle;
    const gameData = Object.assign({}, cloneDeep(GameDB.defaultGameData));
    gameData.isdeleted = false;
    gameData.name = thread.name || this.threadNameFromGame(GatherInterest.gameDisplayName(gather));
    GameIdentity.applyIdentityFromGather(gameData, gather.game);
    GameStatusHelper.setPinnedStatusMode(
      gameData,
      GameStatusHelper.PINNED_STATUS_MODES.FULL
    );

    const ordered = shuffleFn([...seated]);
    for (let i = 0; i < ordered.length; i++) {
      const person = ordered[i];
      gameData.players.push(
        Object.assign({}, cloneDeep(GameDB.defaultPlayer), {
          guildId: gather.guildId,
          userId: person.userId,
          order: i,
          name: person.displayName || `User ${person.userId}`,
        })
      );
    }

    try {
      const actorDisplayName =
        interaction.member?.displayName || interaction.user.username;
      GameHelper.recordMove(
        gameData,
        interaction.user,
        GameDB.ACTION_CATEGORIES.GAME,
        GameDB.ACTION_TYPES.CREATE,
        `${actorDisplayName} started ${gameData.name} from /lfg with ${ordered.length} players`,
        {
          gameName: gameData.name,
          playerCount: ordered.length,
          playerList: ordered.map((person, index) => ({
            userId: person.userId,
            username: person.displayName || person.userId,
            order: index,
          })),
          channelId: thread.id,
          guildId: gather.guildId,
          createdBy: actorDisplayName,
          gatherId: gather.id,
          lfgChannelId: gather.channelId,
        }
      );
    } catch (error) {
      console.warn("Failed to record LFG game creation in history:", error);
    }

    let gameCommitted = false;
    let statusPosted = false;
    try {
      await client.setGameDataV2(gather.guildId, "game", thread.id, gameData, {
        skipPinnedRefresh: true,
      });
      gameCommitted = true;

      if (deps.forumStarterMessageId) {
        gameData.pinnedStatusMessageId = String(deps.forumStarterMessageId);
        gameData.pinnedStatusChannelId = thread.id;
      }

      await this.postFirstStatusMessage(
        thread,
        client,
        gameData,
        gather.guildId,
        GameStatusHelper,
        deps
      );
      statusPosted = true;

      // Table is kept from here: persist started before later steps that can fail,
      // so a retry cannot open a second live game.
      let gatherPersisted = await this.persistGatherStarted(
        client,
        gather,
        thread,
        seated
      );

      try {
        await client.setGameDataV2(gather.guildId, "game", thread.id, gameData, {
          skipPinnedRefresh: true,
        });
      } catch (error) {
        console.error(
          "Failed to save pin fields after LFG status post.",
          error
        );
      }

      const bgg = await this.loadNewGameAnnounce(
        client,
        interaction,
        gather,
        thread,
        deps
      );
      await this.postCreateAnnouncement(thread, gather, seated, warnings, bgg);

      if (!gatherPersisted) {
        gatherPersisted = await this.persistGatherStarted(
          client,
          gather,
          thread,
          seated
        );
      }

      try {
        await GatherInterest.editPanel(interaction, gather);
      } catch (error) {
        console.error("Failed to lock the LFG panel after start.", error);
      }

      if (!gatherPersisted) {
        throw this.hostError(
          `The game thread is live: <#${thread.id}>. I couldn't record that this gather started, so a second Start might open another table. Jump to the thread instead of clicking Start again.`
        );
      }

      const warnText = warnings.length ? `\n⚠️ ${warnings.join(" ")}` : "";
      await GatherInterest.replyEphemeral(
        interaction,
        `Game started in <#${thread.id}>. Seated: ${seated
          .map((person) => `<@${person.userId}>`)
          .join(" ")}${warnText}`
      );
    } catch (error) {
      if (statusPosted) {
        await this.persistGatherStarted(client, gather, thread, seated);
        try {
          await GatherInterest.editPanel(interaction, gather);
        } catch (panelError) {
          console.error("Failed to lock the LFG panel after start.", panelError);
        }
      }
      const hostMessage = error.hostMessage
        ? error
        : this.hostError(
            statusPosted
              ? `The game thread is live: <#${thread.id}>. I couldn't finish every start step. Don't click Start again.`
              : "I created a thread but couldn't finish creating the game. I cleaned up so you can try again."
          );
      hostMessage.keepThread = statusPosted;
      hostMessage.gameCommitted = gameCommitted && !statusPosted;
      throw hostMessage;
    }
  }

  static async persistGatherStarted(client, gather, thread, seated) {
    GatherInterest.markStarted(gather, {
      threadId: thread.id,
      gameId: thread.id,
      seatedUserIds: seated.map((person) => person.userId),
      seatedDisplayNames: this.seatedDisplayNameMap(seated),
    });
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await GatherInterest.saveGather(client, gather);
        return true;
      } catch (error) {
        console.error(
          `Failed to persist gather started status (attempt ${attempt}).`,
          error
        );
      }
    }
    return false;
  }

  static async loadNewGameAnnounce(client, interaction, gather, thread, deps = {}) {
    if (GatherInterest.isCustomGather(gather)) return null;
    const bggId = gather.game?.bggId;
    if (!bggId) return null;
    const load =
      deps.loadBgg ||
      ((id) => {
        const BoardGameGeek = require("./BoardGameGeek");
        return BoardGameGeek.loadNewGameDetails(id, client, interaction);
      });
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await load(bggId);
      } catch (error) {
        console.error(
          `Failed to load BGG details for LFG start (attempt ${attempt}).`,
          error
        );
      }
    }
    throw this.hostError(
      `The game is live in <#${thread.id}>, but I couldn't post the table announcement. Don't click Start again. Open the thread and continue from there.`
    );
  }

  static async postCreateAnnouncement(thread, gather, seated, warnings, bgg = null) {
    const payload = this.buildCreatePost(gather, seated, warnings, bgg);
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await thread.send(payload);
        if (bgg?.otherAttachments?.length) {
          try {
            await thread.send({ files: bgg.otherAttachments });
          } catch (error) {
            console.error(
              "Failed to post extra BGG attachments after LFG start.",
              error
            );
          }
        }
        return;
      } catch (error) {
        console.error(
          `Failed to post game-creation announcement after LFG start (attempt ${attempt}).`,
          error
        );
      }
    }
    throw this.hostError(
      `The game is live in <#${thread.id}>, but I couldn't post the table announcement. Don't click Start again. Open the thread and continue from there.`
    );
  }

  static async postFirstStatusMessage(
    thread,
    client,
    gameData,
    guildId,
    GameStatusHelper,
    deps = {}
  ) {
    const pinInteraction = {
      guildId,
      channelId: thread.id,
    };

    const upsert =
      deps.upsertPinnedStatus ||
      ((channel, bot, interaction, data) =>
        GameStatusHelper.upsertPinnedStatus(channel, bot, interaction, data));

    try {
      await upsert(thread, client, pinInteraction, gameData);
    } catch (error) {
      console.error("Failed to post pinned live status for LFG start.", error);
    }

    if (!gameData.pinnedStatusMessageId) {
      const sent = await thread.send({
        content: GameStatusHelper.buildPinnedStatusContent(),
      });
      gameData.pinnedStatusMessageId = sent.id;
      gameData.pinnedStatusChannelId = thread.id;
      try {
        await sent.pin();
        gameData.pinnedStatusPinned = true;
      } catch (error) {
        console.error("Failed to pin live game status message.", error);
        gameData.pinnedStatusPinned = false;
      }
    } else if (gameData.pinnedStatusPinned !== true) {
      const log = client.logger?.log?.bind(client.logger) || console.warn;
      log(
        `LFG start: live status posted in thread ${thread.id} but pin failed.`,
        "warn"
      );
    }
  }

  static buildCreatePost(gather, seated, warnings, bgg = null) {
    const gameName = GatherInterest.gameDisplayName(gather);
    const seatedLine = seated.map((person) => `<@${person.userId}>`).join(" ");
    const lfgLink = this.jumpUrl(
      gather.guildId,
      gather.channelId,
      gather.interestMessageId
    );
    const warnLine = warnings.length ? `⚠️ ${warnings.join(" ")}` : null;
    const content = [
      `**${gameName}** is on the table.`,
      `Seated: ${seatedLine}`,
      `Host: <@${gather.hostUserId}>`,
      `Interest panel: ${lfgLink}`,
      "Play in this thread — try `/help` or `/help topic:decks`.",
      warnLine,
    ]
      .filter(Boolean)
      .join("\n");

    const mentionIds = [
      ...new Set([
        String(gather.hostUserId),
        ...seated.map((person) => String(person.userId)),
      ]),
    ];
    const payload = {
      content,
      allowedMentions: { users: mentionIds },
    };
    if (bgg?.embeds?.length) payload.embeds = bgg.embeds;
    if (bgg?.attachments?.length) payload.files = bgg.attachments;
    return payload;
  }
}

module.exports = GatherStartGame;
