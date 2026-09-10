const { describe, expect, test } = require("bun:test");
const { EmbedBuilder, MessageFlags } = require("discord.js");
const Formatter = require("../modules/GameFormatter");
const {
  batchEmbeds,
  buildCardListEmbeds,
  catalogEmbed,
  embedCharCount,
  EMBED_DESCRIPTION_LIMIT,
  EMBED_FOOTER_LIMIT,
  EMBED_TITLE_LIMIT,
  EMBED_TOTAL_CHAR_LIMIT,
  formatHandCardLine,
  formatLayoutLabel,
  formatTemplateListLine,
  replyEphemeralEmbeds,
  splitLinesToDescriptions,
} = require("../subcommands/catalog/shared.js");

function mockReplyInteraction(overrides = {}) {
  const calls = { reply: [], editReply: [], followUp: [], deferReply: [] };
  const interaction = {
    deferred: false,
    replied: false,
    deferReply: async (payload) => {
      calls.deferReply.push(payload ?? {});
      interaction.deferred = true;
    },
    reply: async (payload) => {
      calls.reply.push(payload);
      interaction.replied = true;
      return payload;
    },
    editReply: async (payload) => {
      calls.editReply.push(payload);
      interaction.replied = true;
      return payload;
    },
    followUp: async (payload) => {
      calls.followUp.push(payload);
      return payload;
    },
    ...overrides,
  };
  if (overrides.followUp) {
    interaction.followUp = overrides.followUp;
  }
  return { interaction, calls };
}

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
      const chars = batch.reduce((sum, embed) => sum + embedCharCount(embed), 0);
      expect(chars).toBeLessThanOrEqual(EMBED_TOTAL_CHAR_LIMIT);
    }
  });

  test("batchEmbeds counts footer text toward the 6000 combined budget", () => {
    const first = catalogEmbed({
      title: "Enabled (1)",
      description: "d".repeat(4096),
      footer: "f".repeat(2000),
    });
    const second = catalogEmbed({
      title: "Disabled (0)",
      description: "None",
    });
    expect(embedCharCount(first)).toBeLessThanOrEqual(EMBED_TOTAL_CHAR_LIMIT);
    expect(embedCharCount(first) + embedCharCount(second)).toBeGreaterThan(
      EMBED_TOTAL_CHAR_LIMIT
    );
    const batches = batchEmbeds([first, second]);
    expect(batches.length).toBe(2);
    expect(batches[0]).toEqual([first]);
    expect(batches[1]).toEqual([second]);
    for (const batch of batches) {
      const chars = batch.reduce((sum, embed) => sum + embedCharCount(embed), 0);
      expect(chars).toBeLessThanOrEqual(EMBED_TOTAL_CHAR_LIMIT);
    }
  });

  test("a lone embed with max title, description, and footer fits 6000 chars", () => {
    const embed = catalogEmbed({
      title: "T".repeat(EMBED_TITLE_LIMIT),
      description: "D".repeat(EMBED_DESCRIPTION_LIMIT),
      footer: "F".repeat(EMBED_FOOTER_LIMIT),
    });
    expect(embedCharCount(embed)).toBeLessThanOrEqual(EMBED_TOTAL_CHAR_LIMIT);
    expect((embed.data.description || "").length).toBeLessThan(
      EMBED_DESCRIPTION_LIMIT
    );

    const oversized = new EmbedBuilder()
      .setTitle("T".repeat(EMBED_TITLE_LIMIT))
      .setDescription("D".repeat(EMBED_DESCRIPTION_LIMIT))
      .setFooter({ text: "F".repeat(EMBED_FOOTER_LIMIT) });
    expect(embedCharCount(oversized)).toBeGreaterThan(EMBED_TOTAL_CHAR_LIMIT);
    const batches = batchEmbeds([oversized]);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
    expect(embedCharCount(batches[0][0])).toBeLessThanOrEqual(
      EMBED_TOTAL_CHAR_LIMIT
    );
  });

  test("does not mid-clamp markdown image URLs in card lines", () => {
    const url = `https://example.test/${"x".repeat(5000)}.png`;
    const line = formatHandCardLine({ name: "Stafford", url });
    expect(line.length).toBeGreaterThan(EMBED_DESCRIPTION_LIMIT);
    expect(line).toContain(`[image](${url})`);

    const [desc] = splitLinesToDescriptions([line]);
    expect(desc.length).toBeLessThanOrEqual(EMBED_DESCRIPTION_LIMIT);
    expect(desc).toContain("Stafford");
    expect(desc).not.toMatch(/\[image\]\(/);
    expect(desc).not.toContain("https://example.test/");
    expect(desc.endsWith("…") && desc.includes("[image]")).toBe(false);
  });

  test("replyEphemeralEmbeds sends overflow batches as follow-ups", async () => {
    const { interaction, calls } = mockReplyInteraction();
    const embeds = Array.from({ length: 12 }, (_, i) =>
      catalogEmbed({
        title: `Part ${i}`,
        description: "n".repeat(800),
      })
    );
    await replyEphemeralEmbeds(interaction, embeds);
    expect(calls.reply).toHaveLength(1);
    expect(calls.followUp.length).toBeGreaterThanOrEqual(1);
    expect(calls.editReply).toHaveLength(0);
    const sent = [...calls.reply, ...calls.followUp];
    expect(sent.reduce((n, payload) => n + payload.embeds.length, 0)).toBe(12);
    for (const payload of sent) {
      expect(payload.flags).toBe(MessageFlags.Ephemeral);
      expect(payload.embeds.length).toBeLessThanOrEqual(10);
      const chars = payload.embeds.reduce(
        (sum, embed) => sum + embedCharCount(embed),
        0
      );
      expect(chars).toBeLessThanOrEqual(EMBED_TOTAL_CHAR_LIMIT);
    }
  });

  test("follow-up failure leaves the first embed batch in place", async () => {
    const { interaction, calls } = mockReplyInteraction({
      followUp: async () => {
        throw new Error("discord follow-up failed");
      },
    });
    const embeds = Array.from({ length: 12 }, (_, i) =>
      catalogEmbed({
        title: `Part ${i}`,
        description: "n".repeat(800),
      })
    );
    let caught;
    try {
      await replyEphemeralEmbeds(interaction, embeds);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(caught.catalogPrimarySent).toBe(true);
    expect(calls.reply).toHaveLength(1);
    expect(calls.reply[0].embeds[0].data.title).toBe("Part 0");
    expect(calls.editReply).toHaveLength(0);
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
