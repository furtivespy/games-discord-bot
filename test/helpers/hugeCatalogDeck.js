const DeckCatalog = require("../../db/deckCatalog.js");
const {
  EMBED_DESCRIPTION_LIMIT,
  EMBED_TOTAL_CHAR_LIMIT,
  EMBEDS_PER_MESSAGE,
  buildCardListEmbeds,
  embedCharCount,
  enabledHeading,
  formatHandCardLine,
  formatLayoutLabel,
  formatTemplateListLine,
} = require("../../subcommands/catalog/shared.js");

/**
 * Huge-deck regression fixture for /catalog show and list (FUR-81).
 *
 * Sized against the Discord limits catalog shared.js already enforces:
 *   - 4096 chars per embed description (EMBED_DESCRIPTION_LIMIT)
 *   - 6000 combined chars across all embeds in one message (EMBED_TOTAL_CHAR_LIMIT)
 *   - 10 embeds per message (EMBEDS_PER_MESSAGE)
 *
 * If those limits increase and the overflow tests stop requiring follow-ups,
 * bump HUGE_DECK_CARD_COUNT (show) and/or HUGE_LIST_TEMPLATE_COUNT (list)
 * until `hugeShowRawStats().totalChars` is again well above
 * EMBED_TOTAL_CHAR_LIMIT. NAME_PAD can also go up. Keep
 * HUGE_DECK_LONG_URL_CHARS greater than EMBED_DESCRIPTION_LIMIT so markdown
 * image links still exercise clampMarkdownLine instead of fitting whole.
 */

const HUGE_DECK_ID = "huge-regression";
const HUGE_DECK_NAME = "Huge Regression Fixture";
const HUGE_DECK_CARD_COUNT = 300;
const HUGE_DECK_NAME_PAD = 64;
const HUGE_DECK_LONG_URL_CHARS = 4500;
const HUGE_LIST_TEMPLATE_COUNT = 90;
const HUGE_LIST_NAME_PAD = 70;

const HUGE_DECK_LONG_URL_INDEXES = [0, 50, HUGE_DECK_CARD_COUNT - 1];

function paddedCardName(index) {
  const n = String(index).padStart(3, "0");
  return `Huge Card ${n} ${"N".repeat(HUGE_DECK_NAME_PAD)}`;
}

function isLongUrlCard(index) {
  return HUGE_DECK_LONG_URL_INDEXES.includes(index);
}

function cardUrl(index) {
  if (isLongUrlCard(index)) {
    return `https://example.test/huge-regression/${"u".repeat(HUGE_DECK_LONG_URL_CHARS)}.png`;
  }
  return `https://example.test/huge/${index}.png`;
}

function createHugeShowCard(index) {
  const format = index % 7 === 0 ? "B" : "A";
  return {
    name: paddedCardName(index),
    description: "canal mill",
    type: index % 5 === 0 ? "Location" : "",
    suit: "",
    value: "",
    url: cardUrl(index),
    format,
  };
}

function createHugeShowTemplate() {
  return {
    id: HUGE_DECK_ID,
    name: HUGE_DECK_NAME,
    cards: Array.from({ length: HUGE_DECK_CARD_COUNT }, (_, i) =>
      createHugeShowCard(i)
    ),
    createdBy: "seed",
    enabled: 1,
  };
}

function hugeShowHeader(template) {
  const cards = Array.isArray(template.cards) ? template.cards : [];
  return [
    `\`${template.id}\``,
    enabledHeading(template.enabled),
    `${cards.length} cards`,
    formatLayoutLabel(cards),
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildHugeShowEmbeds(template = createHugeShowTemplate()) {
  return buildCardListEmbeds({
    title: template.name,
    header: hugeShowHeader(template),
    cardLines: template.cards.map(formatHandCardLine),
  });
}

function hugeShowRawStats(template = createHugeShowTemplate()) {
  const embeds = buildHugeShowEmbeds(template);
  const totalChars = embeds.reduce((sum, embed) => sum + embedCharCount(embed), 0);
  return { embeds, totalChars, embedCount: embeds.length };
}

function createHugeListTemplates(count = HUGE_LIST_TEMPLATE_COUNT) {
  return Array.from({ length: count }, (_, i) => ({
    id: `huge-list-${i}`,
    name: `Huge List ${String(i).padStart(3, "0")} ${"W".repeat(HUGE_LIST_NAME_PAD)}`,
    cards: [
      {
        name: "A",
        description: "",
        type: "",
        suit: "",
        value: "",
        url: null,
        format: "A",
      },
    ],
    createdBy: "seed",
    enabled: 1,
  }));
}

function hugeListLines(templates = createHugeListTemplates()) {
  return templates.map((template) => formatTemplateListLine(template));
}

function insertHugeShowTemplate(dataDir, template = createHugeShowTemplate()) {
  const catalog = new DeckCatalog({ dataDir });
  try {
    catalog.insertTemplate(template);
  } finally {
    catalog.close();
  }
  return template;
}

function insertHugeListTemplates(
  dataDir,
  templates = createHugeListTemplates()
) {
  const catalog = new DeckCatalog({ dataDir });
  try {
    for (const template of templates) {
      catalog.insertTemplate(template);
    }
  } finally {
    catalog.close();
  }
  return templates;
}

function payloadCharCount(payload) {
  return (payload?.embeds || []).reduce(
    (sum, embed) => sum + embedCharCount(embed),
    0
  );
}

function descriptionHasBrokenMarkdownImageLink(description) {
  const text = String(description || "");
  for (const line of text.split("\n")) {
    const marker = "[image](";
    const start = line.indexOf(marker);
    if (start === -1) {
      if (/\[[^\]]*\]\([^)]*$/.test(line)) return true;
      continue;
    }
    const rest = line.slice(start + marker.length);
    const close = rest.indexOf(")");
    if (close === -1) return true;
    const url = rest.slice(0, close);
    if (url.includes("…") || url.includes("\n")) return true;
  }
  return false;
}

function payloadsHaveBrokenMarkdownImageLinks(payloads) {
  return payloads.some((payload) =>
    (payload?.embeds || []).some((embed) => {
      const data =
        typeof embed?.toJSON === "function"
          ? embed.toJSON()
          : embed?.data || embed;
      return descriptionHasBrokenMarkdownImageLink(data?.description);
    })
  );
}

module.exports = {
  HUGE_DECK_ID,
  HUGE_DECK_NAME,
  HUGE_DECK_CARD_COUNT,
  HUGE_DECK_NAME_PAD,
  HUGE_DECK_LONG_URL_CHARS,
  HUGE_DECK_LONG_URL_INDEXES,
  HUGE_LIST_TEMPLATE_COUNT,
  HUGE_LIST_NAME_PAD,
  EMBED_DESCRIPTION_LIMIT,
  EMBED_TOTAL_CHAR_LIMIT,
  EMBEDS_PER_MESSAGE,
  createHugeShowTemplate,
  createHugeShowCard,
  hugeShowHeader,
  buildHugeShowEmbeds,
  hugeShowRawStats,
  createHugeListTemplates,
  hugeListLines,
  insertHugeShowTemplate,
  insertHugeListTemplates,
  payloadCharCount,
  descriptionHasBrokenMarkdownImageLink,
  payloadsHaveBrokenMarkdownImageLinks,
};
