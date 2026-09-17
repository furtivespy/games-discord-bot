const { EmbedBuilder } = require("discord.js");

const EMBED_COLOR = 13502711;
const EMBED_TITLE_LIMIT = 256;
const EMBED_DESCRIPTION_LIMIT = 4096;
const EMBED_FOOTER_LIMIT = 2048;
const EMBEDS_PER_MESSAGE = 10;
// Discord's combined character budget across all embeds in one message.
const EMBED_TOTAL_CHAR_LIMIT = 6000;

function textEmbed({ title, description, footer, color = EMBED_COLOR } = {}) {
  const embed = new EmbedBuilder().setColor(color);
  const t = title ? truncateTitle(title) : undefined;
  const f = footer ? clampText(footer, EMBED_FOOTER_LIMIT) : undefined;
  const d = description
    ? fitDescriptionToBudget(
        clampText(description, EMBED_DESCRIPTION_LIMIT),
        descriptionBudget(t, f)
      )
    : undefined;
  if (t) embed.setTitle(t);
  if (d) embed.setDescription(d);
  if (f) embed.setFooter({ text: f });
  return embed;
}

function truncateTitle(title) {
  return clampText(String(title || ""), EMBED_TITLE_LIMIT);
}

function clampText(text, limit) {
  const value = String(text || "");
  if (value.length <= limit) return value;
  if (limit <= 0) return "";
  if (limit <= 1) return "…";
  return `${value.slice(0, limit - 1)}…`;
}

// Drop a trailing markdown link instead of slicing through `](…)`.
function dropTrailingMarkdownLink(line) {
  const value = String(line || "");
  const complete = /\s*\[[^\]]*\]\([^)]*\)\s*$/;
  if (complete.test(value)) return value.replace(complete, "");
  const incomplete = /\s*\[[^\]]*\]\([^)]*$/;
  if (incomplete.test(value)) return value.replace(incomplete, "");
  return value;
}

function clampMarkdownLine(raw, limit) {
  const line = String(raw || "");
  if (line.length <= limit) return line;
  const dropped = dropTrailingMarkdownLink(line);
  if (dropped.length < line.length) {
    if (dropped.length <= limit) return dropped;
    return clampText(dropped, limit);
  }
  return clampText(line, limit);
}

function descriptionBudget(title, footer, maxChars = EMBED_TOTAL_CHAR_LIMIT) {
  const without = [title, footer].filter(Boolean).join("\n").length;
  const extraSep = without > 0 ? 1 : 0;
  return Math.min(
    EMBED_DESCRIPTION_LIMIT,
    Math.max(0, maxChars - without - extraSep)
  );
}

function fitDescriptionToBudget(description, budget) {
  const value = String(description || "");
  if (value.length <= budget) return value;
  if (budget <= 0) return "";
  const lines = value.split("\n");
  while (lines.length > 0 && lines.join("\n").length > budget) {
    if (lines.length === 1) {
      lines[0] = clampMarkdownLine(lines[0], budget);
      break;
    }
    const withoutLast = lines.slice(0, -1).join("\n");
    const room = budget - withoutLast.length - 1;
    if (room >= 1) {
      const clamped = clampMarkdownLine(lines[lines.length - 1], room);
      if (clamped) {
        lines[lines.length - 1] = clamped;
        break;
      }
    }
    lines.pop();
  }
  return lines.join("\n");
}

function fitEmbedToCharBudget(embed, maxChars = EMBED_TOTAL_CHAR_LIMIT) {
  if (embedCharCount(embed) <= maxChars) return embed;
  const data =
    typeof embed.toJSON === "function" ? embed.toJSON() : embed.data || embed;
  const title = data.title || "";
  const footerText = data.footer?.text || "";
  const nextDescription = fitDescriptionToBudget(
    data.description || "",
    descriptionBudget(title, footerText, maxChars)
  );
  if (typeof embed.setDescription === "function") {
    if (nextDescription) embed.setDescription(nextDescription);
    else if (embed.data) embed.data.description = undefined;
  } else if (embed.data) {
    embed.data.description = nextDescription || undefined;
  }
  return embed;
}

function splitLinesToDescriptions(lines, limit = EMBED_DESCRIPTION_LIMIT) {
  if (!lines.length) return [""];
  const descriptions = [];
  let chunk = [];
  let size = 0;
  for (const raw of lines) {
    const line =
      String(raw).length > limit
        ? clampMarkdownLine(raw, limit)
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
    textEmbed({
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
    textEmbed({
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
  for (const original of embeds) {
    let embed = original;
    let n = embedCharCount(embed);
    const wouldExceed =
      current.length >= maxPerMessage ||
      (current.length > 0 && chars + n > maxChars);
    if (wouldExceed) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    if (n > maxChars) {
      embed = fitEmbedToCharBudget(embed, maxChars);
      n = embedCharCount(embed);
    }
    current.push(embed);
    chars += n;
  }
  if (current.length) batches.push(current);
  return batches;
}

module.exports = {
  EMBED_COLOR,
  EMBED_TITLE_LIMIT,
  EMBED_DESCRIPTION_LIMIT,
  EMBED_FOOTER_LIMIT,
  EMBEDS_PER_MESSAGE,
  EMBED_TOTAL_CHAR_LIMIT,
  textEmbed,
  splitLinesToDescriptions,
  embedsFromLines,
  buildCardListEmbeds,
  embedPlainText,
  embedCharCount,
  batchEmbeds,
};
