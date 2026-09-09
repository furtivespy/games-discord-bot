const { MessageFlags } = require("discord.js");
const DeckCatalog = require("../../db/deckCatalog.js");
const Formatter = require("../../modules/GameFormatter");

const NOT_OWNER =
  "You do not have permission to use this command. (Bot Owner Only)";

const MIGRATE_HINT =
  "Deck catalog is missing or has an empty schema. Run `/migrate` with job `deck-catalog` first.";

const DISCORD_SAFE_LENGTH = 1900;

function isBotOwner(interaction, client) {
  return interaction.user.id === client.config.botOwnerId;
}

function notOwnerReply() {
  return { content: NOT_OWNER, flags: MessageFlags.Ephemeral };
}

function migrateHintReply() {
  return { content: MIGRATE_HINT, flags: MessageFlags.Ephemeral };
}

function openReadyCatalog() {
  const info = DeckCatalog.inspect();
  if (!info.exists || !info.hasSchema) {
    return { ready: false, catalog: null, info };
  }
  return { ready: true, catalog: new DeckCatalog(), info };
}

function enabledLabel(enabled) {
  return Number(enabled) === 1 ? "enabled" : "disabled";
}

function formatTemplateSummary(template) {
  const count = Array.isArray(template.cards) ? template.cards.length : 0;
  return `${template.id} — ${template.name} — ${enabledLabel(template.enabled)} — ${count} cards`;
}

function formatCardEntry(card) {
  const name = Formatter.cardShortName({
    name: card?.name || "(unnamed)",
    type: card?.type || "",
    value: card?.value ?? "",
    format: card?.format || "A",
    description: card?.description || "",
  });
  if (card?.url) {
    return `${name} (${card.url})`;
  }
  return name;
}

function chunkText(text, limit = DISCORD_SAFE_LENGTH) {
  if (text.length <= limit) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > limit) {
    let splitAt = remaining.lastIndexOf("\n", limit);
    if (splitAt < limit / 2) splitAt = limit;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).replace(/^\n/, "");
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function truncateWithMore(
  items,
  { header = "", limit = DISCORD_SAFE_LENGTH, joiner = "\n" } = {}
) {
  if (items.length === 0) {
    return header;
  }
  let included = [];
  for (let i = 0; i < items.length; i++) {
    const leftover = items.length - (i + 1);
    const trial = [...included, items[i]];
    const more = leftover > 0 ? `${joiner}and ${leftover} more` : "";
    const candidate = `${header}${trial.join(joiner)}${more}`;
    if (candidate.length > limit) {
      if (included.length === 0) {
        const leftoverAll = items.length;
        const suffix = leftoverAll > 1 ? `${joiner}and ${leftoverAll - 1} more` : "";
        const budget = Math.max(0, limit - header.length - suffix.length - 1);
        const clipped = `${items[0].slice(0, budget)}…`;
        return `${header}${clipped}${suffix}`;
      }
      const leftoverCount = items.length - included.length;
      return `${header}${included.join(joiner)}${joiner}and ${leftoverCount} more`;
    }
    included = trial;
  }
  return `${header}${included.join(joiner)}`;
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
      const prefix = Number(template.enabled) === 1 ? "" : "[disabled] ";
      const name = `${prefix}${template.name} (${template.id})`;
      return {
        name: name.slice(0, 100),
        value: template.id,
      };
    });
}

async function replyEphemeral(interaction, content) {
  const chunks = chunkText(content);
  const payload = { content: chunks[0], flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply(payload);
  }
  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({
      content: chunk,
      flags: MessageFlags.Ephemeral,
    });
  }
}

module.exports = {
  NOT_OWNER,
  MIGRATE_HINT,
  DISCORD_SAFE_LENGTH,
  isBotOwner,
  notOwnerReply,
  migrateHintReply,
  openReadyCatalog,
  enabledLabel,
  formatTemplateSummary,
  formatCardEntry,
  chunkText,
  truncateWithMore,
  autocompleteTemplates,
  replyEphemeral,
};
