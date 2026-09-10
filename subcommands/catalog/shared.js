const { EmbedBuilder, MessageFlags } = require("discord.js");
const DeckCatalog = require("../../db/deckCatalog.js");
const {
  isCatalogEnabled,
  classifySqliteOpenError,
} = DeckCatalog;
const Formatter = require("../../modules/GameFormatter");

const NOT_OWNER =
  "You do not have permission to use this command. (Bot Owner Only)";

const MIGRATE_HINT =
  "Deck catalog is missing or has an empty schema. Run `/migrate` with job `deck-catalog` first.";

const CATALOG_EMBED_COLOR = 13502711;
const EMBED_TITLE_LIMIT = 256;
const EMBED_DESCRIPTION_LIMIT = 4096;
const EMBED_FOOTER_LIMIT = 2048;
const EMBEDS_PER_MESSAGE = 10;
// Discord's combined character budget across all embeds in one message.
const EMBED_TOTAL_CHAR_LIMIT = 6000;
const SNOWFLAKE_RE = /^\d{17,20}$/;

function isBotOwner(interaction, client) {
  return interaction.user.id === client.config.botOwnerId;
}

function catalogEmbed({ title, description, footer } = {}) {
  const embed = new EmbedBuilder().setColor(CATALOG_EMBED_COLOR);
  if (title) embed.setTitle(truncateTitle(title));
  if (description) {
    embed.setDescription(clampText(description, EMBED_DESCRIPTION_LIMIT));
  }
  if (footer) embed.setFooter({ text: clampText(footer, EMBED_FOOTER_LIMIT) });
  return embed;
}

function ephemeralEmbedPayload(embeds) {
  return {
    embeds: Array.isArray(embeds) ? embeds : [embeds],
    flags: MessageFlags.Ephemeral,
  };
}

function notOwnerReply() {
  return ephemeralEmbedPayload(catalogEmbed({ description: NOT_OWNER }));
}

function migrateHintReply() {
  return ephemeralEmbedPayload(catalogEmbed({ description: MIGRATE_HINT }));
}

function catalogInspectErrorMessage(info) {
  if (info?.error === "locked") {
    return "Deck catalog database is locked. Try again in a moment.";
  }
  if (info?.error === "corrupt") {
    return "Deck catalog database is corrupt or not a valid sqlite file. Do not run `/migrate` — restore or replace the catalog database.";
  }
  const detail = info?.errorMessage ? ` (${info.errorMessage})` : "";
  return `Deck catalog database could not be read${detail}.`;
}

function catalogUnavailableReply(info) {
  if (info?.error) {
    return ephemeralEmbedPayload(
      catalogEmbed({ description: catalogInspectErrorMessage(info) })
    );
  }
  return migrateHintReply();
}

function openReadyCatalog() {
  const info = DeckCatalog.inspect();
  if (info.error || !info.exists || !info.hasSchema) {
    return { ready: false, catalog: null, info };
  }
  try {
    return { ready: true, catalog: new DeckCatalog(), info };
  } catch (error) {
    return {
      ready: false,
      catalog: null,
      info: {
        ...info,
        hasSchema: false,
        error: classifySqliteOpenError(error),
        errorMessage: String(error?.message || error),
      },
    };
  }
}

function isTemplateEnabled(template) {
  return isCatalogEnabled(template?.enabled);
}

function enabledLabel(enabled) {
  return isCatalogEnabled(enabled) ? "enabled" : "disabled";
}

function enabledHeading(enabled) {
  return isCatalogEnabled(enabled) ? "Enabled" : "Disabled";
}

function cardViewCode(card) {
  const raw = String(card?.format || "A").trim().toUpperCase();
  return raw || "A";
}

function formatLayoutLabel(cards) {
  const list = Array.isArray(cards) ? cards : [];
  const codes = [
    ...new Set(list.map(cardViewCode).filter(Boolean)),
  ];
  if (codes.length === 0) return "Layout A";
  if (codes.length === 1) return `Layout ${codes[0]}`;
  return `Layouts ${codes.join("/")}`;
}

function creatorFetchId(createdBy) {
  if (!createdBy || createdBy === "seed") return null;
  const id = String(createdBy);
  return SNOWFLAKE_RE.test(id) ? id : null;
}

async function resolveCreatorNames(client, createdByValues) {
  const ids = [
    ...new Set(
      (createdByValues || []).map(creatorFetchId).filter(Boolean)
    ),
  ];
  const names = new Map();
  if (!ids.length || !client?.users?.fetch) return names;
  await Promise.all(
    ids.map(async (id) => {
      try {
        const user = await client.users.fetch(id);
        const name = user.displayName || user.globalName || user.username;
        if (name) names.set(id, name);
      } catch {
        // Formatter falls back to a mention when the lookup fails.
      }
    })
  );
  return names;
}

function formatCreatorName(createdBy, creatorNames = new Map()) {
  if (!createdBy || createdBy === "seed") return null;
  const id = String(createdBy);
  if (creatorNames.has(id)) return creatorNames.get(id);
  if (SNOWFLAKE_RE.test(id)) return `<@${id}>`;
  return id;
}

function formatTemplateListLine(template, { creatorNames } = {}) {
  const creator = formatCreatorName(template.created_by, creatorNames);
  const suffix = creator ? `, by ${creator}` : "";
  if (template.cardsError) {
    return `${template.name} (${template.id}): unreadable cards${suffix}`;
  }
  const count = Array.isArray(template.cards) ? template.cards.length : 0;
  const layout = formatLayoutLabel(template.cards);
  return `${template.name} (${template.id}): ${count} cards, ${layout}${suffix}`;
}

function catalogCardForFormatter(card) {
  return {
    name: card?.name || "(unnamed)",
    type: card?.type || "",
    value: card?.value ?? "",
    format: card?.format || "A",
    description: card?.description || "",
  };
}

// Same text shape as GameFormatter.playerSecretHand / genericCardZoneDisplay.
function formatHandCardLine(card) {
  const name = Formatter.cardLongName(catalogCardForFormatter(card));
  if (card?.url) {
    return `• ${name} [image](${card.url})`;
  }
  return `• ${name}`;
}

function truncateTitle(title) {
  return clampText(String(title || ""), EMBED_TITLE_LIMIT);
}

function clampText(text, limit) {
  const value = String(text || "");
  if (value.length <= limit) return value;
  if (limit <= 1) return "…";
  return `${value.slice(0, limit - 1)}…`;
}

function splitLinesToDescriptions(lines, limit = EMBED_DESCRIPTION_LIMIT) {
  if (!lines.length) return [""];
  const descriptions = [];
  let chunk = [];
  let size = 0;
  for (const raw of lines) {
    const line =
      String(raw).length > limit
        ? clampText(raw, limit)
        : String(raw);
    const extra = chunk.length === 0 ? line.length : 1 + line.length;
    if (chunk.length > 0 && size + extra > limit) {
      descriptions.push(chunk.join("\n"));
      chunk = [line];
      size = line.length;
    } else {
      chunk.push(line);
      size += extra;
    }
  }
  if (chunk.length) descriptions.push(chunk.join("\n"));
  return descriptions;
}

function embedsFromLines({ title, lines, emptyText = "None" } = {}) {
  const body = lines && lines.length ? lines : [emptyText];
  return splitLinesToDescriptions(body).map((description, index) =>
    catalogEmbed({
      title: index === 0 ? title : `${title} (cont.)`,
      description,
    })
  );
}

function buildCardListEmbeds({
  title,
  header,
  cardLines,
  footer,
} = {}) {
  const lines = [];
  if (header) {
    lines.push(...String(header).split("\n"));
    lines.push("");
  }
  if (cardLines && cardLines.length) {
    lines.push(...cardLines);
  } else {
    lines.push("Empty");
  }

  const descriptions = splitLinesToDescriptions(lines);
  return descriptions.map((description, index) =>
    catalogEmbed({
      title: index === 0 ? title : `${title} (cont.)`,
      description,
      footer:
        footer && index === descriptions.length - 1 ? footer : undefined,
    })
  );
}

function embedPlainText(embed) {
  if (!embed) return "";
  const data =
    typeof embed.toJSON === "function" ? embed.toJSON() : embed.data || embed;
  const parts = [];
  if (data.title) parts.push(data.title);
  if (data.description) parts.push(data.description);
  for (const field of data.fields || []) {
    if (field.name) parts.push(field.name);
    if (field.value) parts.push(field.value);
  }
  if (data.footer?.text) parts.push(data.footer.text);
  return parts.join("\n");
}

function embedCharCount(embed) {
  return embedPlainText(embed).length;
}

function batchEmbeds(
  embeds,
  {
    maxPerMessage = EMBEDS_PER_MESSAGE,
    maxChars = EMBED_TOTAL_CHAR_LIMIT,
  } = {}
) {
  const batches = [];
  let current = [];
  let chars = 0;
  for (const embed of embeds) {
    const n = embedCharCount(embed);
    const wouldExceed =
      current.length >= maxPerMessage ||
      (current.length > 0 && chars + n > maxChars);
    if (wouldExceed) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(embed);
    chars += n;
  }
  if (current.length) batches.push(current);
  return batches;
}

function autocompleteTemplates(templates, focused, predicate = () => true) {
  const q = String(focused || "").toLowerCase();
  return templates
    .filter(predicate)
    .filter((template) => {
      if (!q) return true;
      return (
        template.id.toLowerCase().includes(q) ||
        template.name.toLowerCase().includes(q)
      );
    })
    .slice(0, 25)
    .map((template) => {
      const prefix = isTemplateEnabled(template) ? "" : "[disabled] ";
      const name = `${prefix}${template.name} (${template.id})`;
      return {
        name: name.slice(0, 100),
        value: template.id,
      };
    });
}

async function replyEphemeralEmbeds(interaction, embeds) {
  const list = (embeds || []).filter(Boolean);
  const batches = list.length ? batchEmbeds(list) : [[catalogEmbed({ description: "\u200b" })]];
  for (let i = 0; i < batches.length; i++) {
    const payload = ephemeralEmbedPayload(batches[i]);
    if (i === 0) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply(payload);
      }
    } else {
      await interaction.followUp(payload);
    }
  }
}

async function replyEphemeral(interaction, content) {
  await replyEphemeralEmbeds(interaction, [
    catalogEmbed({ description: content }),
  ]);
}

module.exports = {
  NOT_OWNER,
  MIGRATE_HINT,
  CATALOG_EMBED_COLOR,
  EMBED_TITLE_LIMIT,
  EMBED_DESCRIPTION_LIMIT,
  EMBED_FOOTER_LIMIT,
  EMBEDS_PER_MESSAGE,
  EMBED_TOTAL_CHAR_LIMIT,
  isBotOwner,
  catalogEmbed,
  notOwnerReply,
  migrateHintReply,
  catalogUnavailableReply,
  catalogInspectErrorMessage,
  openReadyCatalog,
  isTemplateEnabled,
  enabledLabel,
  enabledHeading,
  formatLayoutLabel,
  formatCreatorName,
  formatTemplateListLine,
  formatHandCardLine,
  resolveCreatorNames,
  splitLinesToDescriptions,
  embedsFromLines,
  buildCardListEmbeds,
  embedPlainText,
  embedCharCount,
  batchEmbeds,
  autocompleteTemplates,
  replyEphemeral,
  replyEphemeralEmbeds,
};
