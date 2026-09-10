const { describe, expect, test } = require("bun:test");
const { EmbedBuilder } = require("discord.js");
const Formatter = require("../modules/GameFormatter");
const {
  batchEmbeds,
  buildCardListEmbeds,
  catalogEmbed,
  EMBED_DESCRIPTION_LIMIT,
  EMBED_TOTAL_CHAR_LIMIT,
  formatHandCardLine,
  formatLayoutLabel,
  formatTemplateListLine,
  splitLinesToDescriptions,
} = require("../subcommands/catalog/shared.js");

describe("catalog format helpers", () => {
  test("list line puts name first, then id, count, layout, and creator", () => {
    const line = formatTemplateListLine(
      {
        id: "brass-two",
        name: "Brass Birmingham - 2 Players",
        cards: Array.from({ length: 40 }, () => ({ format: "B" })),
        created_by: "Will",
      },
      { creatorNames: new Map() }
    );
    expect(line).toBe(
      "Brass Birmingham - 2 Players (brass-two): 40 cards, Layout B, by Will"
    );
  });

  test("omits seed creator and reports mixed layouts", () => {
    expect(
      formatTemplateListLine({
        id: "mixed",
        name: "Mixed",
        cards: [{ format: "A" }, { format: "C" }],
        created_by: "seed",
      })
    ).toBe("Mixed (mixed): 2 cards, Layouts A/C");
  });

  test("layout label defaults to A when cards are missing", () => {
    expect(formatLayoutLabel(undefined)).toBe("Layout A");
    expect(formatLayoutLabel([{ format: "c" }])).toBe("Layout C");
  });

  test("card lines match the in-hand formatter (long name, bullet, image link)", () => {
    const card = {
      name: "Stafford",
      type: "Location",
      value: "",
      format: "B",
      description: "canal",
      url: "https://furtivespy.com/images/brass/stafford.png",
    };
    const expectedName = Formatter.cardLongName({
      name: card.name,
      type: card.type,
      value: card.value,
      format: card.format,
      description: card.description,
    });
    expect(formatHandCardLine(card)).toBe(
      `• ${expectedName} [image](${card.url})`
    );
    expect(formatHandCardLine(card)).toBe(
      "• Location: Stafford (canal) [image](https://furtivespy.com/images/brass/stafford.png)"
    );
    expect(formatHandCardLine({ name: "King", format: "A" })).toBe("• King");
  });

  test("card list embeds reuse the hand-style lines and split long descriptions", () => {
    const longName = "X".repeat(80);
    const cards = Array.from({ length: 80 }, (_, i) => ({
      name: `${longName}-${i}`,
      type: "",
      value: "",
      format: "A",
      description: "",
    }));
    const embeds = buildCardListEmbeds({
      title: "Big Deck",
      header: "`big` · Enabled · 80 cards · Layout A",
      cardLines: cards.map(formatHandCardLine),
      footer: "cutover note",
    });
    expect(embeds.length).toBeGreaterThan(1);
    expect(embeds[0].data.title).toBe("Big Deck");
    expect(embeds[0].data.description).toContain("`big`");
    expect(embeds[0].data.description).toContain("• ");
    expect(embeds.at(-1).data.title).toContain("(cont.)");
    expect(embeds.at(-1).data.footer.text).toBe("cutover note");
    for (const embed of embeds) {
      expect((embed.data.description || "").length).toBeLessThanOrEqual(
        EMBED_DESCRIPTION_LIMIT
      );
    }
  });

  test("batchEmbeds keeps Discord per-message embed and character limits", () => {
    const embeds = Array.from({ length: 12 }, (_, i) =>
      catalogEmbed({
        title: `Part ${i}`,
        description: "n".repeat(800),
      })
    );
    const batches = batchEmbeds(embeds);
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(10);
      const chars = batch.reduce(
        (sum, embed) =>
          sum +
          (embed.data.title || "").length +
          (embed.data.description || "").length,
        0
      );
      expect(chars).toBeLessThanOrEqual(EMBED_TOTAL_CHAR_LIMIT);
    }
  });

  test("splitLinesToDescriptions does not exceed the description cap", () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i} ${"y".repeat(40)}`);
    const parts = splitLinesToDescriptions(lines);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(EMBED_DESCRIPTION_LIMIT);
    }
  });

  test("catalogEmbed is a discord.js EmbedBuilder", () => {
    const embed = catalogEmbed({ title: "Enabled (1)", description: "Hello" });
    expect(embed).toBeInstanceOf(EmbedBuilder);
    expect(embed.data.color).toBe(13502711);
  });
});
