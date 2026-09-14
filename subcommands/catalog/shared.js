const { MessageFlags } = require("discord.js");
const DeckCatalog = require("../../db/deckCatalog.js");
const { classifySqliteOpenError, isCatalogEnabled, isEnabled } =
  DeckCatalog;
const {
  batchEmbeds,
  textEmbed,
} = require("../../modules/DiscordEmbeds");

const NOT_OWNER =
  "You do not have permission to use this command. (Bot Owner Only)";

const MIGRATE_HINT =
  "Deck catalog is missing or has an empty schema. Run `/migrate` with job `deck-catalog` first.";

const SNOWFLAKE_RE = /^\d{17,20}$/;

function isBotOwner(interaction, client) {
  return interaction.user.id === client.config.botOwnerId;
}

function catalogEmbed(opts) {
  return textEmbed(opts);
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
    return { ready: true, catalog: new DeckCatalog() };
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
      const prefix = isEnabled(template) ? "" : "[disabled] ";
      const name = `${prefix}${template.name} (${template.id})`;
      return {
        name: name.slice(0, 100),
        value: template.id,
      };
    });
}

async function deferCatalogReply(interaction) {
  if (!interaction || interaction.deferred || interaction.replied) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
}

async function replyEphemeralEmbeds(interaction, embeds) {
  const list = (embeds || []).filter(Boolean);
  const batches = list.length
    ? batchEmbeds(list)
    : [[catalogEmbed({ description: "\u200b" })]];
  let primarySent = false;
  try {
    for (let i = 0; i < batches.length; i++) {
      const payload = ephemeralEmbedPayload(batches[i]);
      if (i === 0) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(payload);
        } else {
          await interaction.reply(payload);
        }
        primarySent = true;
      } else {
        await interaction.followUp(payload);
      }
    }
  } catch (err) {
    if (primarySent) {
      err.catalogPrimarySent = true;
    }
    throw err;
  }
}

async function replyEphemeral(interaction, content) {
  await replyEphemeralEmbeds(interaction, [
    catalogEmbed({ description: content }),
  ]);
}

module.exports = {
  isBotOwner,
  catalogEmbed,
  notOwnerReply,
  catalogUnavailableReply,
  openReadyCatalog,
  enabledHeading,
  formatLayoutLabel,
  formatCreatorName,
  formatTemplateListLine,
  resolveCreatorNames,
  autocompleteTemplates,
  deferCatalogReply,
  replyEphemeral,
  replyEphemeralEmbeds,
};
