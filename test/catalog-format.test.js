const { describe, expect, test } = require("bun:test");
const { EmbedBuilder, MessageFlags } = require("discord.js");
const Formatter = require("../modules/GameFormatter");
const {
  batchEmbeds,
  buildCardListEmbeds,
  embedCharCount,
  embedsFromLines,
  EMBED_COLOR,
  EMBED_DESCRIPTION_LIMIT,
  EMBED_FOOTER_LIMIT,
  EMBEDS_PER_MESSAGE,
  EMBED_TITLE_LIMIT,
  EMBED_TOTAL_CHAR_LIMIT,
  splitLinesToDescriptions,
  textEmbed,
} = require("../modules/DiscordEmbeds");
const {
  autocompleteTemplates,
  catalogEmbed,
  formatLayoutLabel,
  formatTemplateListLine,
  replyEphemeralEmbeds,
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

function payloadsFromCalls(calls) {
  const primary = calls.editReply[0] || calls.reply[0];
  return primary ? [primary, ...calls.followUp] : [...calls.followUp];
}

function embedText(embeds) {
  return (embeds || []).map((embed) => embed.data?.description || "").join("\n");
}

function payloadsText(payloads) {
  return payloads.map((payload) => embedText(payload.embeds)).join("\n");
}

function expectPayloadsWithinDiscordLimits(payloads) {
  for (const payload of payloads) {
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
    expect(payload.embeds.length).toBeLessThanOrEqual(EMBEDS_PER_MESSAGE);
    const chars = (payload.embeds || []).reduce(
      (sum, embed) => sum + embedCharCount(embed),
      0
    );
    expect(chars).toBeLessThanOrEqual(EMBED_TOTAL_CHAR_LIMIT);
    for (const embed of payload.embeds) {
      expect((embed.data.description || "").length).toBeLessThanOrEqual(
        EMBED_DESCRIPTION_LIMIT
      );
    }
  }
}

function expectOverflowMarkers(text, markers) {
  for (const marker of markers) {
    expect(text).toContain(marker);
  }
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

  test("list line surfaces unreadable cards instead of a count", () => {
    expect(
      formatTemplateListLine({
        id: "broken",
        name: "Broken",
        cards: [],
        cardsError: "invalid_json",
        created_by: "seed",
      })
    ).toBe("Broken (broken): unreadable cards");
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
    expect(Formatter.cardHandLine(card)).toBe(
      `• ${expectedName} [image](${card.url})`
    );
    expect(Formatter.cardHandLine(card)).toBe(
      "• Location: Stafford (canal) [image](https://furtivespy.com/images/brass/stafford.png)"
    );
    expect(Formatter.cardHandLine({ name: "King", format: "A" })).toBe("• King");
    expect(Formatter.playerSecretHand(
      { name: "demo" },
      { hands: { main: [card] } }
    ).data.fields[0].value.trim()).toBe(Formatter.cardHandLine(card));
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
      cardLines: cards.map((card) => Formatter.cardHandLine(card)),
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
      textEmbed({
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
    const line = Formatter.cardHandLine({ name: "Stafford", url });
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
      textEmbed({
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
      textEmbed({
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

  test("textEmbed is a discord.js EmbedBuilder", () => {
    const embed = textEmbed({ title: "Enabled (1)", description: "Hello" });
    expect(embed).toBeInstanceOf(EmbedBuilder);
    expect(embed.data.color).toBe(EMBED_COLOR);
    expect(catalogEmbed({ description: "Hello" }).data.color).toBe(EMBED_COLOR);
  });

  test("autocompleteTemplates filters by focus so the 25-cap does not hide later names", () => {
    const templates = [
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `aaa-${String(i).padStart(2, "0")}`,
        name: `AAA ${String(i).padStart(2, "0")}`,
        enabled: 1,
      })),
      { id: "zebra-late", name: "Zebra Late", enabled: 1 },
    ];

    const empty = autocompleteTemplates(templates, "");
    expect(empty).toHaveLength(25);
    expect(empty.map((choice) => choice.value)).not.toContain("zebra-late");

    const focused = autocompleteTemplates(templates, "zeb");
    expect(focused.map((choice) => choice.value)).toEqual(["zebra-late"]);
    expect(focused[0].name.toLowerCase()).toContain("zebra");

    const byId = autocompleteTemplates(templates, "zebra-late");
    expect(byId.map((choice) => choice.value)).toEqual(["zebra-late"]);
    expect(byId[0].name.toLowerCase().startsWith("zebra-late")).toBe(true);

    const substring = autocompleteTemplates(templates, "late");
    expect(substring.map((choice) => choice.value)).toEqual(["zebra-late"]);
    expect(substring[0].name.startsWith("late")).toBe(true);
    expect(substring[0].name).toContain("Zebra Late");
  });
});

describe("huge-deck catalog fixture (FUR-81)", () => {
  const {
    HUGE_DECK_CARD_COUNT,
    HUGE_DECK_LONG_URL_CHARS,
    HUGE_DECK_LONG_URL_INDEXES,
    HUGE_LIST_TEMPLATE_COUNT,
    buildHugeShowEmbeds,
    createHugeShowTemplate,
    hugeListLines,
    hugeListOverflowMarkers,
    hugeShowOverflowMarkers,
    hugeShowRawStats,
    payloadCharCount,
    payloadsHaveBrokenMarkdownImageLinks,
  } = require("./helpers/hugeCatalogDeck");

  test("fixture still overflows Discord combined-char budget (bump HUGE_DECK_CARD_COUNT if limits rise)", () => {
    // Discord currently allows 6000 combined embed chars / 10 embeds per
    // message. If those limits change and this fails because the fixture
    // no longer overflows, increase HUGE_DECK_CARD_COUNT (and/or NAME_PAD)
    // in test/helpers/hugeCatalogDeck.js until totalChars is again well
    // above EMBED_TOTAL_CHAR_LIMIT. Keep HUGE_DECK_LONG_URL_CHARS > 4096.
    const { totalChars, embedCount, embeds } = hugeShowRawStats();
    expect(HUGE_DECK_CARD_COUNT).toBeGreaterThanOrEqual(100);
    expect(HUGE_DECK_LONG_URL_CHARS).toBeGreaterThan(EMBED_DESCRIPTION_LIMIT);
    expect(embeds.length).toBe(embedCount);
    expect(embedCount).toBeGreaterThan(1);
    expect(totalChars).toBeGreaterThan(EMBED_TOTAL_CHAR_LIMIT);
  });

  test("show helper keeps the first page legal and sends overflow as extra batches", () => {
    const embeds = buildHugeShowEmbeds();
    const batches = batchEmbeds(embeds);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches[0].length).toBeLessThanOrEqual(EMBEDS_PER_MESSAGE);
    const firstChars = batches[0].reduce(
      (sum, embed) => sum + embedCharCount(embed),
      0
    );
    expect(firstChars).toBeGreaterThan(EMBED_TOTAL_CHAR_LIMIT / 2);
    expect(firstChars).toBeLessThanOrEqual(EMBED_TOTAL_CHAR_LIMIT);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(EMBEDS_PER_MESSAGE);
      const chars = batch.reduce((sum, embed) => sum + embedCharCount(embed), 0);
      expect(chars).toBeLessThanOrEqual(EMBED_TOTAL_CHAR_LIMIT);
      for (const embed of batch) {
        expect((embed.data.description || "").length).toBeLessThanOrEqual(
          EMBED_DESCRIPTION_LIMIT
        );
      }
    }
    expectOverflowMarkers(embedText(embeds), hugeShowOverflowMarkers());
  });

  test("list helper overflow stays inside Discord per-message limits", () => {
    expect(HUGE_LIST_TEMPLATE_COUNT).toBeGreaterThan(60);
    const lines = hugeListLines();
    const embeds = embedsFromLines({
      title: `Enabled (${lines.length})`,
      lines,
    });
    const batches = batchEmbeds(embeds);
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(EMBEDS_PER_MESSAGE);
      const chars = batch.reduce((sum, embed) => sum + embedCharCount(embed), 0);
      expect(chars).toBeLessThanOrEqual(EMBED_TOTAL_CHAR_LIMIT);
      for (const embed of batch) {
        expect((embed.data.description || "").length).toBeLessThanOrEqual(
          EMBED_DESCRIPTION_LIMIT
        );
      }
    }
    expectOverflowMarkers(embedText(embeds), hugeListOverflowMarkers());
  });

  test("replyEphemeralEmbeds does not pack the huge show deck into one illegal payload", async () => {
    const { interaction, calls } = mockReplyInteraction({ deferred: true });
    await replyEphemeralEmbeds(interaction, buildHugeShowEmbeds());
    expect(calls.editReply).toHaveLength(1);
    expect(calls.reply).toHaveLength(0);
    expect(calls.followUp.length).toBeGreaterThanOrEqual(1);
    const sent = payloadsFromCalls(calls);
    expectPayloadsWithinDiscordLimits(sent);
    expectOverflowMarkers(payloadsText(sent), hugeShowOverflowMarkers());
  });

  test("follow-up failure leaves the huge-deck first page in place", async () => {
    const { interaction, calls } = mockReplyInteraction({
      deferred: true,
      followUp: async () => {
        throw new Error("discord follow-up failed");
      },
    });
    let caught;
    try {
      await replyEphemeralEmbeds(interaction, buildHugeShowEmbeds());
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(caught.catalogPrimarySent).toBe(true);
    expect(calls.editReply).toHaveLength(1);
    expect(calls.reply).toHaveLength(0);
    expect(calls.editReply[0].embeds[0].data.title).toBe(
      createHugeShowTemplate().name
    );
    expect(payloadCharCount(calls.editReply[0])).toBeLessThanOrEqual(
      EMBED_TOTAL_CHAR_LIMIT
    );
    expect(calls.followUp).toHaveLength(0);
  });

  test("follow-up failure leaves the huge-list first page in place", async () => {
    const { interaction, calls } = mockReplyInteraction({
      deferred: true,
      followUp: async () => {
        throw new Error("discord follow-up failed");
      },
    });
    const embeds = embedsFromLines({
      title: `Enabled (${HUGE_LIST_TEMPLATE_COUNT})`,
      lines: hugeListLines(),
    });
    let caught;
    try {
      await replyEphemeralEmbeds(interaction, embeds);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(caught.catalogPrimarySent).toBe(true);
    expect(calls.editReply).toHaveLength(1);
    expect(calls.reply).toHaveLength(0);
    expect(calls.editReply[0].embeds[0].data.title).toBe(
      `Enabled (${HUGE_LIST_TEMPLATE_COUNT})`
    );
    expect(payloadCharCount(calls.editReply[0])).toBeLessThanOrEqual(
      EMBED_TOTAL_CHAR_LIMIT
    );
    expect(calls.followUp).toHaveLength(0);
  });

  test("long markdown image URLs on huge-deck lines are not mid-clamped", () => {
    const template = createHugeShowTemplate();
    const longLine = Formatter.cardHandLine(template.cards[0]);
    expect(longLine.length).toBeGreaterThan(EMBED_DESCRIPTION_LIMIT);
    expect(longLine).toContain("[image](https://example.test/huge-regression/");

    const embeds = buildHugeShowEmbeds(template);
    const text = embedText(embeds);
    expect(payloadsHaveBrokenMarkdownImageLinks([{ embeds }])).toBe(false);
    expectOverflowMarkers(text, hugeShowOverflowMarkers());
    expect(HUGE_DECK_LONG_URL_INDEXES).toEqual([0, 50, HUGE_DECK_CARD_COUNT - 1]);
    expect(text).not.toMatch(/\[image\]\([^)\n]*$/m);
    expect(text).not.toContain("[image](https://example.test/huge-regression/");
    expect(text).not.toContain("u".repeat(80));
    expect(text).not.toMatch(/\[image\]\([^)]*…/);
  });
});
