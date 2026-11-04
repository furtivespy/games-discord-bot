const { AttachmentBuilder } = require("discord.js");
const GuildConfig = require("./GuildConfig");
const { createGeminiAI } = require("./GoogleGemini");

const MAX_WINNERS = 4;
const PORTRAIT_FILENAME = "winner-portrait.png";

// One tunable prompt. {{gameName}} is replaced at generate time.
const WINNER_PORTRAIT_PROMPT = `Create a playful, SFW royal portrait from the attached Discord avatar image(s). Keep each person or avatar recognizable as the same character. If more than one avatar is attached, compose one shared group portrait of all of them together. Crown them and add regal flair such as a throne, cape, confetti, or a trophy, themed to the board game "{{gameName}}". They are the undisputed royalty of that game. Use gender-neutral wording and imagery (royalty). Do not include any text, letters, numbers, captions, titles, or watermarks in the image.`;

function logPortraitSkip(client, reason) {
  const message =
    reason instanceof Error
      ? reason.message || String(reason)
      : String(reason || "unknown");
  const line = `Winner portrait skipped: ${message}`;
  if (typeof client?.logger?.warn === "function") {
    client.logger.warn(line);
  } else if (typeof client?.logger?.log === "function") {
    client.logger.log(line, "warn");
  } else {
    console.warn(line);
  }
}

function normalizeWinnerIds(winner) {
  if (winner == null || winner === "") return [];
  const list = Array.isArray(winner) ? winner : [winner];
  return [...new Set(list.map((id) => String(id)))].sort();
}

function sameWinnerIds(a, b) {
  const left = normalizeWinnerIds(a);
  const right = normalizeWinnerIds(b);
  if (!left.length || !right.length || left.length !== right.length) {
    return false;
  }
  return left.every((id, index) => id === right[index]);
}

function canReusePortrait(existing, winnerIds) {
  if (!existing?.channelId || !existing?.messageId) return false;
  return sameWinnerIds(existing.winnerUserIds, winnerIds);
}

function buildPrompt(gameName) {
  const name = String(gameName || "this game").trim() || "this game";
  return WINNER_PORTRAIT_PROMPT.replaceAll("{{gameName}}", name);
}

function decidePortraitAction({
  winnerIds,
  existingPortrait,
  portraitOption,
  guildEnabled,
  hasGeminiKey,
} = {}) {
  const ids = normalizeWinnerIds(winnerIds);
  if (ids.length < 1) {
    return { action: "skip", reason: "no-winners" };
  }
  if (ids.length > MAX_WINNERS) {
    return { action: "skip", reason: "too-many-winners" };
  }
  // Reuse never calls Gemini and never clears a valid stored pointer, even
  // when `portrait` is omitted. A re-run without portrait:true re-attaches
  // the existing image instead of wiping it.
  if (canReusePortrait(existingPortrait, ids)) {
    return { action: "reuse", winnerIds: ids };
  }
  // Generation is opt-in. Omitted (null/undefined) and explicit false both skip
  // Gemini; a missing guild/settings row must not generate on its own.
  if (portraitOption !== true) {
    return {
      action: "skip",
      reason: portraitOption === false ? "opt-out" : "not-requested",
    };
  }
  if (guildEnabled === false) {
    return { action: "skip", reason: "guild-disabled" };
  }
  if (!hasGeminiKey) {
    return { action: "skip", reason: "missing-gemini-key", log: true };
  }
  return { action: "generate", winnerIds: ids };
}

function winnerAvatarUrl(member, user) {
  const opts = { extension: "png", size: 512 };
  if (typeof member?.displayAvatarURL === "function") {
    try {
      const url = member.displayAvatarURL(opts);
      if (url) return url;
    } catch (_) {
      /* fall through to user avatar */
    }
  }
  if (typeof user?.displayAvatarURL === "function") {
    try {
      const url = user.displayAvatarURL(opts);
      if (url) return url;
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

function lookupProvidedUser(usersById, userId) {
  if (!usersById) return null;
  if (typeof usersById.get === "function") {
    return usersById.get(userId) || null;
  }
  return usersById[userId] || null;
}

async function resolveMember(guild, userId) {
  const cached = guild?.members?.cache?.get?.(userId);
  if (cached) return cached;
  if (typeof guild?.members?.fetch === "function") {
    return await guild.members.fetch(userId);
  }
  return null;
}

async function downloadImageBuffer(url, fetchImpl) {
  const res = await fetchImpl(url);
  if (!res?.ok) {
    throw new Error(`image fetch failed (${res?.status || "no response"})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) {
    throw new Error("empty image");
  }
  let mimeType = "image/png";
  const header = res.headers?.get?.("content-type");
  if (typeof header === "string" && header.startsWith("image/")) {
    mimeType = header.split(";")[0].trim();
  }
  return { buffer, mimeType };
}

async function fetchInlineImage(url, fetchImpl) {
  const { buffer, mimeType } = await downloadImageBuffer(url, fetchImpl);
  return { mimeType, data: buffer.toString("base64") };
}

async function collectWinnerAvatars({
  guild,
  winnerIds,
  fetchImpl,
  usersById,
  client,
} = {}) {
  const images = [];
  for (const id of winnerIds) {
    try {
      let member = null;
      try {
        member = await resolveMember(guild, id);
      } catch (error) {
        logPortraitSkip(
          client,
          `could not fetch member for ${id}: ${error?.message || error}`
        );
      }
      const user = member?.user || lookupProvidedUser(usersById, id);
      const url = winnerAvatarUrl(member, user);
      if (!url) {
        logPortraitSkip(client, `no avatar URL for ${id}`);
        continue;
      }
      images.push(await fetchInlineImage(url, fetchImpl));
    } catch (error) {
      logPortraitSkip(
        client,
        `could not load avatar for ${id}: ${error?.message || error}`
      );
    }
  }
  return images;
}

function applyPortraitToEmbed(embed, buffer) {
  const file = new AttachmentBuilder(buffer, { name: PORTRAIT_FILENAME });
  if (embed && typeof embed.setImage === "function") {
    embed.setImage(`attachment://${PORTRAIT_FILENAME}`);
  }
  return file;
}

function attachmentList(message) {
  const atts = message?.attachments;
  if (!atts) return [];
  if (Array.isArray(atts)) return atts;
  if (typeof atts.values === "function") return [...atts.values()];
  if (typeof atts.forEach === "function") {
    const out = [];
    atts.forEach((value) => out.push(value));
    return out;
  }
  return Object.values(atts);
}

function findPortraitAttachment(message) {
  const list = attachmentList(message);
  return list.find((item) => item?.name === PORTRAIT_FILENAME) || null;
}

async function resolvePortraitChannel({ client, guild, gameChannel, channelId }) {
  if (gameChannel?.id === channelId && gameChannel.messages) {
    return gameChannel;
  }
  const cached = client?.channels?.cache?.get?.(channelId);
  if (cached) return cached;
  if (typeof client?.channels?.fetch === "function") {
    const fetched = await client.channels.fetch(channelId).catch(() => null);
    if (fetched) return fetched;
  }
  if (typeof guild?.channels?.fetch === "function") {
    const fetched = await guild.channels.fetch(channelId).catch(() => null);
    if (fetched) return fetched;
  }
  if (gameChannel?.id === channelId) return gameChannel;
  return null;
}

async function fetchStoredPortraitBuffer({
  client,
  guild,
  gameChannel,
  portrait,
  fetchImpl,
} = {}) {
  if (!portrait?.channelId || !portrait?.messageId) return null;
  const channel = await resolvePortraitChannel({
    client,
    guild,
    gameChannel,
    channelId: portrait.channelId,
  });
  if (!channel?.messages?.fetch) return null;
  const message = await channel.messages.fetch(portrait.messageId);
  const attachment = findPortraitAttachment(message);
  const url =
    attachment?.url ||
    attachment?.proxyURL ||
    message?.embeds?.[0]?.image?.url ||
    message?.embeds?.[0]?.data?.image?.url;
  if (!url) return null;
  const { buffer } = await downloadImageBuffer(url, fetchImpl || fetch);
  return buffer;
}

async function fileFromStoredPortrait(ctx) {
  const buffer = await WinnerPortrait.fetchStoredPortraitBuffer(ctx);
  if (!buffer) return null;
  return new AttachmentBuilder(buffer, { name: PORTRAIT_FILENAME });
}

async function generatePortraitImage({
  client,
  gameName,
  winnerIds,
  guild,
  fetchImpl,
  winnerUsers,
} = {}) {
  const ids = normalizeWinnerIds(winnerIds);
  const images = await collectWinnerAvatars({
    guild,
    winnerIds: ids,
    fetchImpl: fetchImpl || fetch,
    usersById: winnerUsers,
    client,
  });
  if (images.length < ids.length) {
    logPortraitSkip(
      client,
      `loaded ${images.length}/${ids.length} winner avatars`
    );
    return null;
  }
  if (!images.length) return null;
  const gemini = createGeminiAI(client);
  const generated = await gemini.generateImage({
    prompt: buildPrompt(gameName),
    images,
    model: gemini.imageModelName(),
  });
  return generated?.buffer || null;
}

async function loadLatestGame(client, interaction, fallback) {
  return (
    (await client.getGameDataV2(
      interaction.guildId,
      "game",
      interaction.channelId
    )) || fallback
  );
}

function jobStillOwnsGame(latest, winnerIds) {
  if (!latest || latest.isdeleted) return false;
  return sameWinnerIds(latest.winner, winnerIds);
}

function shouldClearJobPortrait(latest, winnerIds, { onlyIfStale = false } = {}) {
  if (!jobStillOwnsGame(latest, winnerIds)) return false;
  if (latest.winnerPortrait == null) return false;
  if (
    onlyIfStale &&
    sameWinnerIds(latest.winnerPortrait.winnerUserIds, winnerIds)
  ) {
    return false;
  }
  return true;
}

async function persistPortraitRef(client, interaction, gameData, winnerIds, edited) {
  const ids = normalizeWinnerIds(winnerIds);
  const messageId = String(edited?.id || "");
  const channelId = String(edited?.channelId || interaction.channelId || "");
  if (!messageId || !channelId) {
    throw new Error("missing portrait message id");
  }
  const winnerPortrait = {
    winnerUserIds: ids,
    channelId,
    messageId,
  };

  const latest = await loadLatestGame(client, interaction, gameData);
  if (!jobStillOwnsGame(latest, ids)) {
    logPortraitSkip(client, "portrait persist aborted; winners changed");
    return;
  }

  // Re-read immediately before write so a concurrent winner/delete is not
  // overwritten by this job's stale whole-row snapshot.
  const fresh = await loadLatestGame(client, interaction, latest);
  if (!jobStillOwnsGame(fresh, ids)) {
    logPortraitSkip(client, "portrait persist aborted; winners changed");
    return;
  }
  fresh.winnerPortrait = winnerPortrait;
  await client.setGameDataV2(
    interaction.guildId,
    "game",
    interaction.channelId,
    fresh
  );
}

async function clearJobWinnerPortrait(
  client,
  interaction,
  winnerIds,
  fallback,
  { onlyIfStale = false } = {}
) {
  const ids = normalizeWinnerIds(winnerIds);
  const latest = await loadLatestGame(client, interaction, fallback);
  if (!shouldClearJobPortrait(latest, ids, { onlyIfStale })) return;

  const fresh = await loadLatestGame(client, interaction, latest);
  if (!shouldClearJobPortrait(fresh, ids, { onlyIfStale })) return;
  fresh.winnerPortrait = null;
  await client.setGameDataV2(
    interaction.guildId,
    "game",
    interaction.channelId,
    fresh
  );
}

async function afterWinnerPosted(ctx) {
  const {
    client,
    interaction,
    gameData,
    winEmbed,
    winnerIds,
    portraitOption,
    winnerUsers,
  } = ctx;
  const ids = normalizeWinnerIds(winnerIds);

  const clearStale = () =>
    clearJobWinnerPortrait(client, interaction, ids, gameData, {
      onlyIfStale: true,
    });

  try {
    const decision = decidePortraitAction({
      winnerIds: ids,
      existingPortrait: gameData?.winnerPortrait,
      portraitOption,
      guildEnabled: GuildConfig.isWinnerPortraitsEnabled(
        client,
        interaction.guild
      ),
      hasGeminiKey: Boolean(client?.config?.geminiKey),
    });

    if (decision.action === "skip") {
      if (decision.log) logPortraitSkip(client, decision.reason);
      await clearStale();
      return;
    }

    let buffer = null;
    let shouldGenerate = decision.action === "generate";

    if (decision.action === "reuse") {
      try {
        buffer = await WinnerPortrait.fetchStoredPortraitBuffer({
          client,
          guild: interaction.guild,
          gameChannel: interaction.channel,
          portrait: gameData.winnerPortrait,
        });
      } catch (error) {
        logPortraitSkip(client, error);
      }
      if (!buffer) {
        logPortraitSkip(client, "stored portrait missing");
        await clearJobWinnerPortrait(client, interaction, ids, gameData);
        const retry = decidePortraitAction({
          winnerIds: ids,
          existingPortrait: null,
          portraitOption,
          guildEnabled: GuildConfig.isWinnerPortraitsEnabled(
            client,
            interaction.guild
          ),
          hasGeminiKey: Boolean(client?.config?.geminiKey),
        });
        shouldGenerate = retry.action === "generate";
        if (!shouldGenerate) {
          if (retry.log) logPortraitSkip(client, retry.reason);
          return;
        }
      }
    }

    if (!buffer && shouldGenerate) {
      buffer = await WinnerPortrait.generatePortraitImage({
        client,
        gameName: gameData.name,
        winnerIds: decision.winnerIds || ids,
        guild: interaction.guild,
        winnerUsers,
      });
      if (!buffer) {
        logPortraitSkip(client, "no portrait image produced");
        await clearStale();
        return;
      }
    }

    if (!buffer) {
      await clearStale();
      return;
    }

    const file = applyPortraitToEmbed(winEmbed, buffer);
    const edited = await interaction.editReply({
      embeds: [winEmbed],
      files: [file],
    });
    const reply = edited?.id ? edited : await interaction.fetchReply();
    await persistPortraitRef(
      client,
      interaction,
      gameData,
      decision.winnerIds || ids,
      reply
    );
  } catch (error) {
    logPortraitSkip(client, error);
    try {
      await clearStale();
    } catch (clearError) {
      logPortraitSkip(client, clearError);
    }
  }
}

function scheduleAfterWinnerPosted(ctx) {
  const work = WinnerPortrait.afterWinnerPosted(ctx).catch((error) => {
    logPortraitSkip(ctx.client, error);
  });
  if (ctx.client) {
    ctx.client.lastWinnerPortraitWork = work;
  }
  return work;
}

const WinnerPortrait = {
  MAX_WINNERS,
  PORTRAIT_FILENAME,
  WINNER_PORTRAIT_PROMPT,
  logPortraitSkip,
  normalizeWinnerIds,
  sameWinnerIds,
  canReusePortrait,
  buildPrompt,
  decidePortraitAction,
  winnerAvatarUrl,
  collectWinnerAvatars,
  applyPortraitToEmbed,
  findPortraitAttachment,
  fetchStoredPortraitBuffer,
  fileFromStoredPortrait,
  generatePortraitImage,
  persistPortraitRef,
  clearJobWinnerPortrait,
  afterWinnerPosted,
  scheduleAfterWinnerPosted,
};

module.exports = WinnerPortrait;
