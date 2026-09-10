const { describe, expect, test, beforeEach } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { MessageFlags } = require("discord.js");
const GatherInterest = require("../modules/GatherInterest");
const GameStore = require("../db/gameStore.js");
const Lfg = require("../slashcommands/info/lfg.js");

function sampleGame(overrides = {}) {
  return {
    bggId: "266192",
    name: "Wingspan",
    image: "https://example.com/wingspan.png",
    minPlayers: 1,
    maxPlayers: 5,
    minPlaytime: 40,
    maxPlaytime: 70,
    weight: "2.45",
    yearPublished: 2019,
    url: "https://boardgamegeek.com/boardgame/266192",
    ...overrides,
  };
}

function sampleGather(overrides = {}) {
  return GatherInterest.createGather({
    guildId: "guild-1",
    channelId: "channel-1",
    hostUserId: "host-1",
    hostDisplayName: "Hosty",
    game: sampleGame(),
    now: new Date("2026-09-07T12:00:00.000Z"),
    ...overrides,
  });
}

function memoryClient(initial = {}) {
  const store = { ...initial };
  return {
    store,
    getGameDataV2: async (guildId, collection, id) => {
      const key = `${guildId}:${collection}:${id}`;
      const value = store[key];
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
    setGameDataV2: async (guildId, collection, id, data) => {
      store[`${guildId}:${collection}:${id}`] = JSON.parse(JSON.stringify(data));
    },
  };
}

function buttonInteraction({
  customId,
  userId = "user-1",
  displayName = "Alex",
  guildId = "guild-1",
  edits,
  replies,
} = {}) {
  const interaction = {
    customId,
    guildId,
    user: { id: userId, username: displayName },
    member: { displayName },
    deferred: false,
    replied: false,
    message: {
      edit: async (payload) => {
        edits.push(payload);
        return payload;
      },
    },
    deferReply: async () => {
      interaction.deferred = true;
    },
    reply: async (payload) => {
      interaction.replied = true;
      replies.push(payload);
      return payload;
    },
    editReply: async (payload) => {
      replies.push(payload);
      return payload;
    },
  };
  return interaction;
}

describe("GatherInterest levels and roster", () => {
  test("counts header includes three levels with Flexible last", () => {
    const gather = sampleGather();
    GatherInterest.upsertInterest(gather, "a", "very", "A", new Date("2026-09-07T12:01:00Z"));
    GatherInterest.upsertInterest(gather, "b", "somewhat", "B", new Date("2026-09-07T12:02:00Z"));
    GatherInterest.upsertInterest(gather, "c", "somewhat", "C", new Date("2026-09-07T12:03:00Z"));
    GatherInterest.upsertInterest(gather, "d", "somewhat", "D", new Date("2026-09-07T12:04:00Z"));
    GatherInterest.upsertInterest(gather, "e", "flexible", "E", new Date("2026-09-07T12:05:00Z"));

    expect(GatherInterest.headerCounts(gather)).toBe(
      "Very: 1 · Somewhat: 3 · Flexible: 1"
    );
  });

  test("roster groups strongest-first and keeps one entry per user", () => {
    const gather = sampleGather();
    GatherInterest.upsertInterest(gather, "a", "somewhat", "Ann", new Date("2026-09-07T12:01:00Z"));
    GatherInterest.upsertInterest(gather, "a", "very", "Ann", new Date("2026-09-07T12:02:00Z"));
    GatherInterest.upsertInterest(gather, "b", "flexible", "Bob", new Date("2026-09-07T12:03:00Z"));

    const text = GatherInterest.buildRosterText(gather);
    expect(text.indexOf("Very interested")).toBeLessThan(text.indexOf("Flexibly interested"));
    expect(text).toContain("Ann · <@a>");
    expect(text).toContain("Bob · <@b>");
    expect(text).not.toContain("Only a little interested");
    expect(text).not.toContain("Give my spot away");
    expect(Object.keys(gather.interests)).toEqual(["a", "b"]);
    expect(gather.interests.a.level).toBe("very");
  });

  test("same-level click keeps registration instead of toggling off", () => {
    const gather = sampleGather();
    GatherInterest.upsertInterest(gather, "a", "somewhat", "Ann");
    GatherInterest.upsertInterest(gather, "a", "somewhat", "Ann");
    expect(gather.interests.a.level).toBe("somewhat");
    expect(Object.keys(gather.interests)).toHaveLength(1);
  });

  test("empty roster has a prompt instead of empty groups", () => {
    const gather = sampleGather();
    expect(GatherInterest.buildRosterText(gather)).toContain("No one has registered yet");
  });

  test("panel description shows host, game, and flexible as first-class", () => {
    const gather = sampleGather();
    GatherInterest.upsertInterest(gather, "flex", "flexible", "Casey");
    const description = GatherInterest.buildPanelDescription(gather);
    expect(description).toContain("Hosty · <@host-1>");
    expect(description).toContain("[Wingspan](https://boardgamegeek.com/boardgame/266192)");
    expect(description).toContain("1–5 players");
    expect(description).toContain("**Flexibly interested**");
    expect(description).toContain("Casey · <@flex>");
    expect(description).toContain("Flexible: 1");
    expect(description).toContain(GatherInterest.FLEXIBLE_MEANING);
    expect(description).not.toContain("Give my spot away");
  });
});

describe("GatherInterest panel components", () => {
  test("open panel has three interest buttons plus host Close", () => {
    const gather = sampleGather();
    const rows = GatherInterest.buildPanelComponents(gather).map((row) => row.toJSON());
    expect(rows[0].components.map((c) => c.label)).toEqual([
      "Very interested",
      "Somewhat interested",
      "Flexibly interested",
    ]);
    expect(rows[0].components.every((c) => c.disabled === false)).toBe(true);
    expect(rows[1].components[0].label).toBe("Close interest");
    expect(rows[0].components[2].custom_id).toBe(
      GatherInterest.interestCustomId(gather.id, "flexible")
    );
  });

  test("closed panel disables interest buttons and offers Re-open", () => {
    const gather = sampleGather();
    GatherInterest.setStatus(gather, "closed", new Date("2026-09-07T13:00:00Z"));
    const rows = GatherInterest.buildPanelComponents(gather).map((row) => row.toJSON());
    expect(rows[0].components.every((c) => c.disabled === true)).toBe(true);
    expect(rows[1].components[0].label).toBe("Re-open interest");
    expect(gather.status).toBe("closed");
    expect(gather.closedAt).toBe("2026-09-07T13:00:00.000Z");
  });
});

describe("GatherInterest custom ids", () => {
  test("parses interest, close, and reopen ids", () => {
    expect(GatherInterest.parseCustomId("gather:somewhat:abc")).toEqual({
      action: "interest",
      level: "somewhat",
      gatherId: "abc",
    });
    expect(GatherInterest.parseCustomId("gather:close:abc")).toEqual({
      action: "close",
      gatherId: "abc",
    });
    expect(GatherInterest.parseCustomId("gather:reopen:abc")).toEqual({
      action: "reopen",
      gatherId: "abc",
    });
    expect(GatherInterest.parseCustomId("gather:little:abc")).toEqual({
      action: "interest",
      level: "somewhat",
      gatherId: "abc",
    });
    expect(GatherInterest.parseCustomId("public")).toBeNull();
    expect(GatherInterest.parseCustomId("gather:nope:abc")).toBeNull();
  });
});

describe("GatherInterest legacy four-level migration", () => {
  test("upserting little stores somewhat so old clicks keep people on the roster", () => {
    const gather = sampleGather();
    GatherInterest.upsertInterest(gather, "d", "little", "Dee");
    expect(gather.interests.d.level).toBe("somewhat");
    expect(GatherInterest.headerCounts(gather)).toBe(
      "Very: 0 · Somewhat: 1 · Flexible: 0"
    );
    expect(GatherInterest.buildRosterText(gather)).toContain("**Somewhat interested**");
    expect(GatherInterest.buildRosterText(gather)).toContain("Dee · <@d>");
    expect(GatherInterest.buildRosterText(gather)).not.toContain("Only a little interested");
  });

  test("normalizeGather maps stored little to somewhat and is idempotent", () => {
    const gather = sampleGather();
    gather.interests = {
      a: { level: "little", displayName: "Ann", updatedAt: "2026-09-07T12:04:00.000Z" },
      b: { level: "very", displayName: "Bob", updatedAt: "2026-09-07T12:01:00.000Z" },
      c: { level: "flexible", displayName: "Casey", updatedAt: "2026-09-07T12:05:00.000Z" },
    };
    GatherInterest.normalizeGather(gather);
    expect(gather.interests.a.level).toBe("somewhat");
    expect(gather.interests.b.level).toBe("very");
    expect(gather.interests.c.level).toBe("flexible");
    GatherInterest.normalizeGather(gather);
    expect(gather.interests.a.level).toBe("somewhat");
    expect(GatherInterest.headerCounts(gather)).toBe(
      "Very: 1 · Somewhat: 1 · Flexible: 1"
    );
  });

  test("loadGather rewrites little onto somewhat without dropping the person", async () => {
    const gather = sampleGather();
    gather.interests = {
      d: { level: "little", displayName: "Dee", updatedAt: "2026-09-07T12:04:00.000Z" },
    };
    const client = memoryClient({
      [`${gather.guildId}:${GatherInterest.COLLECTION}:${gather.id}`]: gather,
    });
    const loaded = await GatherInterest.loadGather(client, gather.guildId, gather.id);
    expect(loaded.interests.d.level).toBe("somewhat");
    expect(GatherInterest.buildRosterText(loaded)).toContain("Dee · <@d>");
    expect(GatherInterest.buildRosterText(loaded)).toContain("**Somewhat interested**");
  });

  test("clicking an old little button registers as somewhat and rebuilds three buttons", async () => {
    const gather = sampleGather();
    gather.interests = {
      other: { level: "little", displayName: "Other", updatedAt: "2026-09-07T12:04:00.000Z" },
    };
    const client = memoryClient({
      [`${gather.guildId}:${GatherInterest.COLLECTION}:${gather.id}`]: gather,
    });
    const edits = [];
    const replies = [];
    await GatherInterest.handleButton(
      buttonInteraction({
        customId: `gather:little:${gather.id}`,
        userId: "user-1",
        displayName: "Alex",
        edits,
        replies,
      }),
      client
    );
    expect(replies[0].content).toBe("Registered: Somewhat interested");
    const stored = await client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.interests["user-1"].level).toBe("somewhat");
    expect(stored.interests.other.level).toBe("somewhat");
    expect(edits[0].components[0].components.map((c) => c.data.label)).toEqual([
      "Very interested",
      "Somewhat interested",
      "Flexibly interested",
    ]);
  });
});

describe("GatherInterest BGG snapshot", () => {
  test("captures the fields used on the panel", () => {
    const snapshot = GatherInterest.snapshotFromBgg({
      gameId: 266192,
      gameName: "Wingspan",
      gameInfo: {
        image: "https://example.com/wingspan.png",
        minplayers: 1,
        maxplayers: 5,
        minplaytime: 40,
        maxplaytime: 70,
        yearpublished: 2019,
        statistics: { ratings: { averageweight: "2.45" } },
      },
    });
    expect(snapshot).toEqual(sampleGame());
  });
});

describe("GatherInterest persistence shape", () => {
  test("does not use game-document fields that would trigger migrateGameData", () => {
    const gather = sampleGather();
    expect(gather.kind).toBe("gather");
    expect(gather.name).toBeUndefined();
    expect(gather.players).toBeUndefined();
    expect(gather.decks).toBeUndefined();
    expect(gather.tokens).toBeUndefined();
    expect(gather.game.name).toBe("Wingspan");
  });

  test("survives JSON round-trip used by sqlite documents", () => {
    const gather = sampleGather();
    GatherInterest.upsertInterest(gather, "a", "flexible", "Ann");
    const restored = JSON.parse(JSON.stringify(gather));
    expect(restored.interests.a.level).toBe("flexible");
    expect(GatherInterest.headerCounts(restored)).toBe(
      "Very: 0 · Somewhat: 0 · Flexible: 1"
    );
  });

  test("GameStore keeps gather documents across a new connection", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gather-store-"));
    const previous = process.env.GAMEBOT_DATA_DIR;
    process.env.GAMEBOT_DATA_DIR = tmp;
    let store1;
    let store2;
    try {
      store1 = new GameStore();
      const gather = sampleGather();
      GatherInterest.upsertInterest(gather, "a", "very", "Ann");
      store1.upsertGameData(gather.guildId, GatherInterest.COLLECTION, gather.id, gather);
      store1.db.close();

      store2 = new GameStore();
      const loaded = store2.getSpecificGameData(
        gather.guildId,
        GatherInterest.COLLECTION,
        gather.id
      );
      expect(loaded.kind).toBe("gather");
      expect(loaded.hostUserId).toBe("host-1");
      expect(loaded.interests.a.level).toBe("very");
      expect(loaded.game.bggId).toBe("266192");
    } finally {
      try { store2?.db.close(); } catch {}
      if (previous === undefined) delete process.env.GAMEBOT_DATA_DIR;
      else process.env.GAMEBOT_DATA_DIR = previous;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("GatherInterest button handler", () => {
  let gather;
  let client;
  let edits;
  let replies;

  beforeEach(() => {
    gather = sampleGather();
    client = memoryClient({
      [`${gather.guildId}:${GatherInterest.COLLECTION}:${gather.id}`]: gather,
    });
    edits = [];
    replies = [];
  });

  test("registers interest, edits the panel in place, and confirms ephemerally", async () => {
    const interaction = buttonInteraction({
      customId: GatherInterest.interestCustomId(gather.id, "somewhat"),
      edits,
      replies,
    });

    const handled = await GatherInterest.handleButton(interaction, client);
    expect(handled).toBe(true);
    expect(edits).toHaveLength(1);
    expect(edits[0].allowedMentions).toEqual({ parse: [] });
    expect(edits[0].embeds[0].data.description).toContain("Alex · <@user-1>");
    expect(replies[0]).toMatchObject({
      content: "Registered: Somewhat interested",
      flags: MessageFlags.Ephemeral,
    });

    const stored = await client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.interests["user-1"].level).toBe("somewhat");
  });

  test("changing level updates the single roster entry", async () => {
    GatherInterest.upsertInterest(gather, "user-1", "very", "Alex");
    await client.setGameDataV2(gather.guildId, GatherInterest.COLLECTION, gather.id, gather);

    await GatherInterest.handleButton(
      buttonInteraction({
        customId: GatherInterest.interestCustomId(gather.id, "flexible"),
        edits,
        replies,
      }),
      client
    );

    const stored = await client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(Object.keys(stored.interests)).toEqual(["user-1"]);
    expect(stored.interests["user-1"].level).toBe("flexible");
    expect(replies[0].content).toBe(
      `Registered: ${GatherInterest.LEVELS.flexible.confirm}`
    );
    expect(edits[0].embeds[0].data.description).toContain("**Flexibly interested**");
    expect(edits[0].embeds[0].data.description).not.toContain("**Very interested**");
  });

  test("host can close interest so buttons stop accepting clicks", async () => {
    await GatherInterest.handleButton(
      buttonInteraction({
        customId: GatherInterest.closeCustomId(gather.id),
        userId: "host-1",
        displayName: "Hosty",
        edits,
        replies,
      }),
      client
    );
    expect(replies[0].content).toContain("Interest closed");
    expect(edits[0].components[0].components.every((c) => c.data.disabled)).toBe(true);

    const closedClicks = [];
    const closedReplies = [];
    await GatherInterest.handleButton(
      buttonInteraction({
        customId: GatherInterest.interestCustomId(gather.id, "very"),
        edits: closedClicks,
        replies: closedReplies,
      }),
      client
    );
    expect(closedClicks).toHaveLength(0);
    expect(closedReplies[0].content).toBe("Interest is closed for this gather.");
  });

  test("non-host cannot close interest", async () => {
    await GatherInterest.handleButton(
      buttonInteraction({
        customId: GatherInterest.closeCustomId(gather.id),
        userId: "intruder",
        edits,
        replies,
      }),
      client
    );
    expect(replies[0].content).toBe("Only the host can close interest.");
    expect(edits).toHaveLength(0);
    const stored = await client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.status).toBe("open");
  });

  test("host can re-open a closed gather", async () => {
    GatherInterest.setStatus(gather, "closed");
    await client.setGameDataV2(gather.guildId, GatherInterest.COLLECTION, gather.id, gather);

    await GatherInterest.handleButton(
      buttonInteraction({
        customId: GatherInterest.reopenCustomId(gather.id),
        userId: "host-1",
        displayName: "Hosty",
        edits,
        replies,
      }),
      client
    );
    expect(replies[0].content).toContain("re-opened");
    const stored = await client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.status).toBe("open");
    expect(edits[0].components[0].components.every((c) => !c.data.disabled)).toBe(true);
  });

  test("ignores unrelated buttons so collectors keep working", async () => {
    const interaction = buttonInteraction({
      customId: "public",
      edits,
      replies,
    });
    const handled = await GatherInterest.handleButton(interaction, client);
    expect(handled).toBe(false);
    expect(interaction.deferred).toBe(false);
    expect(replies).toHaveLength(0);
  });
});

describe("GatherInterest two-phase save race", () => {
  test("post-save does not clobber a click that already registered", async () => {
    const gather = sampleGather();
    const client = memoryClient();
    await GatherInterest.saveGather(client, gather);

    const posted = JSON.parse(JSON.stringify(gather));
    posted.gameMessageId = "game-msg";
    posted.interestMessageId = "panel-msg";

    const edits = [];
    const replies = [];
    await GatherInterest.handleButton(
      buttonInteraction({
        customId: GatherInterest.interestCustomId(gather.id, "very"),
        edits,
        replies,
      }),
      client
    );
    expect(replies[0].content).toBe("Registered: Very interested");

    const afterClick = await client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(afterClick.interests["user-1"].level).toBe("very");
    expect(afterClick.interestMessageId).toBeNull();

    // Command save #2 still holds the empty in-memory roster plus new ids.
    await GatherInterest.saveGatherAfterPost(client, posted);

    const stored = await client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.interests["user-1"].level).toBe("very");
    expect(stored.gameMessageId).toBe("game-msg");
    expect(stored.interestMessageId).toBe("panel-msg");
    expect(Object.keys(stored.interests)).toEqual(["user-1"]);
  });

  test("concurrent click and post-save keep both interests and message ids", async () => {
    const gather = sampleGather();
    const client = memoryClient();
    await GatherInterest.saveGather(client, gather);

    const posted = JSON.parse(JSON.stringify(gather));
    posted.gameMessageId = "game-msg";
    posted.interestMessageId = "panel-msg";

    const originalSet = client.setGameDataV2;
    client.setGameDataV2 = async (...args) => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return originalSet(...args);
    };

    const edits = [];
    const replies = [];
    await Promise.all([
      GatherInterest.handleButton(
        buttonInteraction({
          customId: GatherInterest.interestCustomId(gather.id, "somewhat"),
          edits,
          replies,
        }),
        client
      ),
      GatherInterest.saveGatherAfterPost(client, posted),
    ]);

    const stored = await client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.interests["user-1"].level).toBe("somewhat");
    expect(stored.gameMessageId).toBe("game-msg");
    expect(stored.interestMessageId).toBe("panel-msg");
    expect(replies[0].content).toBe("Registered: Somewhat interested");
  });

  test("withGatherLock serializes the same gather and releases the map entry", async () => {
    const order = [];
    await Promise.all([
      GatherInterest.withGatherLock("lock-a", async () => {
        order.push("a-start");
        await new Promise((resolve) => setTimeout(resolve, 20));
        order.push("a-end");
      }),
      GatherInterest.withGatherLock("lock-a", async () => {
        order.push("b-start");
        order.push("b-end");
      }),
    ]);
    expect(order).toEqual(["a-start", "a-end", "b-start", "b-end"]);

    // After both waiters finish the last one must delete the entry so a
    // later lock is not chained onto a resolved leftover promise forever.
    expect(GatherInterest.hasActiveLock("lock-a")).toBe(false);
    const after = [];
    await GatherInterest.withGatherLock("lock-a", async () => {
      after.push("c");
    });
    expect(after).toEqual(["c"]);
    expect(GatherInterest.hasActiveLock("lock-a")).toBe(false);
  });
});

describe("/lfg command", () => {
  test("slash description fits Discord's 100-character limit and teaches the feature", () => {
    const command = new Lfg({ config: {}, logger: { log: () => {} } });
    const json = command.data.toJSON();
    expect(json.name).toBe("lfg");
    expect(json.description).toBe("Look up a game on BGG and open a Who's interested? panel.");
    expect(json.description.length).toBeLessThanOrEqual(100);
    expect(json.options[0].description.length).toBeLessThanOrEqual(100);
  });

  test("rejects a raw name that is not a BGG id, matching /bgg", async () => {
    const replies = [];
    const command = new Lfg({ config: { BGGToken: "token" }, logger: { log: () => {} } });
    await command.execute({
      guildId: "guild-1",
      isAutocomplete: () => false,
      options: { getString: () => "Wingspan" },
      reply: async (payload) => replies.push(payload),
    });
    expect(replies[0].content).toContain("Please choose from the available options");
    expect(replies[0].flags).toBe(MessageFlags.Ephemeral);
  });

  test("autocomplete uses BoardGameGeek.Search like /bgg and /game newgame", async () => {
    const BoardGameGeek = require("../modules/BoardGameGeek");
    const original = BoardGameGeek.Search;
    const calls = [];
    BoardGameGeek.Search = async (query, token) => {
      calls.push([query, token]);
      return [{ name: "Wingspan (2019)", value: "266192" }];
    };
    try {
      const command = new Lfg({ config: { BGGToken: "bgg-token" }, logger: { log: () => {} } });
      const responded = [];
      await command.execute({
        isAutocomplete: () => true,
        options: { getString: () => "wing" },
        respond: async (choices) => responded.push(choices),
      });
      expect(calls).toEqual([["wing", "bgg-token"]]);
      expect(responded[0]).toEqual([{ name: "Wingspan (2019)", value: "266192" }]);
    } finally {
      BoardGameGeek.Search = original;
    }
  });
});
