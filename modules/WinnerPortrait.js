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
  if (portraitOption === false) {
    return { action: "skip", reason: "opt-out" };
  }
  if (guildEnabled === false) {
    return { action: "skip", reason: "guild-disabled" };
  }
  if (ids.length < 1) {
    return { action: "skip", reason: "no-winners" };
  }
  if (ids.length > MAX_WINNERS) {
    return { action: "skip", reason: "too-many-winners" };
  }
  if (canReusePortrait(existingPortrait, ids)) {
    return { action: "reuse", winnerIds: ids };
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

async function resolveMember(guild, userId) {
  const cached = guild?.members?.cache?.get?.(userId);
  if (cached) return cached;
  if (typeof guild?.members?.fetch === "function") {
    return await guild.members.fetch(userId);
  }
  return null;
}

async function fetchInlineImage(url, fetchImpl) {
  const res = await fetchImpl(url);
  if (!res?.ok) {
    throw new Error(`avatar fetch failed (${res?.status || "no response"})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) {
    throw new Error("empty avatar image");
  }
  let mimeType = "image/png";
  const header = res.headers?.get?.("content-type");
  if (typeof header === "string" && header.startsWith("image/")) {
    mimeType = header.split(";")[0].trim();
  }
  return { mimeType, data: buffer.toString("base64") };
}

async function collectWinnerAvatars(guild, winnerIds, fetchImpl) {
  const images = [];
  for (const id of winnerIds) {
    try {
      const member = await resolveMember(guild, id);
      const url = winnerAvatarUrl(member, member?.user);
      if (!url) continue;
      images.push(await fetchInlineImage(url, fetchImpl));
    } catch (error) {
      console.warn(
        `Winner portrait: could not load avatar for ${id}:`,
        error?.message || error
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
  return list.find((item) => item?.name === PORTRAIT_FILENAME) || list[0] || null;
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
  const res = await (fetchImpl || fetch)(url);
  if (!res?.ok) {
    throw new Error(`portrait refetch failed (${res?.status || "no response"})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer.length ? buffer : null;
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
} = {}) {
  const images = await collectWinnerAvatars(
    guild,
    normalizeWinnerIds(winnerIds),
    fetchImpl || fetch
  );
  if (!images.length) return null;
  const gemini = createGeminiAI(client);
  const generated = await gemini.generateImage({
    prompt: buildPrompt(gameName),
    images,
    model: gemini.imageModelName(),
  });
  return generated?.buffer || null;
}

async function persistPortraitRef(client, interaction, gameData, winnerIds, edited) {
  const latest =
    (await client.getGameDataV2(
      interaction.guildId,
      "game",
      interaction.channelId
    )) || gameData;
  const messageId = String(edited?.id || "");
  const channelId = String(edited?.channelId || interaction.channelId || "");
  if (!messageId || !channelId) {
    throw new Error("missing portrait message id");
  }
  latest.winnerPortrait = {
    winnerUserIds: normalizeWinnerIds(winnerIds),
    channelId,
    messageId,
  };
  await client.setGameDataV2(
    interaction.guildId,
    "game",
    interaction.channelId,
    latest
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
  } = ctx;

  try {
    const decision = decidePortraitAction({
      winnerIds,
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
      return;
    }

    let buffer = null;
    if (decision.action === "reuse") {
      buffer = await WinnerPortrait.fetchStoredPortraitBuffer({
        client,
        guild: interaction.guild,
        gameChannel: interaction.channel,
        portrait: gameData.winnerPortrait,
      });
      if (!buffer) {
        logPortraitSkip(client, "stored portrait missing");
        return;
      }
    } else {
      buffer = await WinnerPortrait.generatePortraitImage({
        client,
        gameName: gameData.name,
        winnerIds: decision.winnerIds || winnerIds,
        guild: interaction.guild,
      });
      if (!buffer) {
        logPortraitSkip(client, "no image from Gemini");
        return;
      }
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
      decision.winnerIds || winnerIds,
      reply
    );
  } catch (error) {
    logPortraitSkip(client, error);
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
  applyPortraitToEmbed,
  fetchStoredPortraitBuffer,
  fileFromStoredPortrait,
  generatePortraitImage,
  afterWinnerPosted,
  scheduleAfterWinnerPosted,
};

module.exports = WinnerPortrait;
