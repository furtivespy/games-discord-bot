const { describe, expect, test, beforeEach } = require("bun:test");
const { ChannelType, MessageFlags } = require("discord.js");
const GatherInterest = require("../modules/GatherInterest");
const GatherStartGame = require("../modules/GatherStartGame");

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
    channelId: "lfg-channel",
    hostUserId: "host-1",
    hostDisplayName: "Hosty",
    game: sampleGame(),
    now: new Date("2026-09-07T12:00:00.000Z"),
    ...overrides,
  });
}

function memoryClient(initial = {}, settings = { lfg_game_parent_channel_id: "games-channel" }) {
  const store = { ...initial };
  return {
    store,
    settings,
    logger: { log() {} },
    getSettings: () => ({ ...settings }),
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

function addInterest(gather, userId, level, displayName, at) {
  GatherInterest.upsertInterest(
    gather,
    userId,
    level,
    displayName,
    at || new Date("2026-09-07T12:01:00Z")
  );
}

describe("GatherInterest seat picker helpers", () => {
  test("sorts Very → Somewhat → Flexibly and tags labels", () => {
    const gather = sampleGather();
    addInterest(gather, "flex", "flexible", "Casey", new Date("2026-09-07T12:01:00Z"));
    addInterest(gather, "some", "somewhat", "Sam", new Date("2026-09-07T12:02:00Z"));
    addInterest(gather, "very", "very", "Val", new Date("2026-09-07T12:03:00Z"));

    const sorted = GatherInterest.interestedSorted(gather).map((p) => p.userId);
    expect(sorted).toEqual(["very", "some", "flex"]);

    const { options, truncated, total } = GatherInterest.buildSeatSelectOptions(gather);
    expect(truncated).toBe(false);
    expect(total).toBe(3);
    expect(options.map((o) => o.value)).toEqual(["very", "some", "flex"]);
    expect(options[0].label).toBe("Val · Very");
    expect(options[1].label).toBe("Sam · Somewhat");
    expect(options[2].label).toBe("Casey · Flexible");
  });

  test("defaults max seats to BGG max clamped by interested count and 25", () => {
    const gather = sampleGather();
    expect(GatherInterest.defaultSeatCount(gather, 8)).toBe(5);
    expect(GatherInterest.defaultSeatCount(gather, 3)).toBe(3);
    gather.game.maxPlayers = 40;
    expect(GatherInterest.defaultSeatCount(gather, 30)).toBe(25);
    gather.game.maxPlayers = null;
    expect(GatherInterest.defaultSeatCount(gather, 9)).toBe(9);
  });

  test("seat select maxValues is interested count, not BGG max", () => {
    const gather = sampleGather({ game: sampleGame({ maxPlayers: 2 }) });
    addInterest(gather, "a", "very", "Ann");
    addInterest(gather, "b", "somewhat", "Bob");
    addInterest(gather, "c", "flexible", "Casey");
    const meta = GatherStartGame.buildSeatSelectRow(gather);
    expect(meta.maxValues).toBe(3);
    expect(meta.row.components[0].data.max_values).toBe(3);
  });

  test("keeps the top 25 by strength when more than 25 people are interested", () => {
    const gather = sampleGather();
    for (let i = 0; i < 20; i++) {
      addInterest(gather, `flex-${i}`, "flexible", `Flex${i}`, new Date(2026, 8, 7, 12, i));
    }
    for (let i = 0; i < 10; i++) {
      addInterest(gather, `very-${i}`, "very", `Very${i}`, new Date(2026, 8, 7, 13, i));
    }
    const { options, truncated, total, shown } =
      GatherInterest.buildSeatSelectOptions(gather);
    expect(total).toBe(30);
    expect(shown).toBe(25);
    expect(truncated).toBe(true);
    expect(options.filter((o) => o.value.startsWith("very-"))).toHaveLength(10);
    expect(options[0].value).toBe("very-0");
    expect(options[24].value).toBe("flex-14");
  });
});

describe("GatherStartGame warnings and create post", () => {
  test("warns below BGG min but does not warn inside range", () => {
    const gather = sampleGather({ game: sampleGame({ minPlayers: 3, maxPlayers: 5 }) });
    expect(GatherStartGame.seatCountWarnings(gather, 2)[0]).toContain("minimum of 3");
    expect(GatherStartGame.seatCountWarnings(gather, 3)).toEqual([]);
    expect(GatherStartGame.seatCountWarnings(gather, 6)[0]).toContain("maximum of 5");
  });

  test("create post names seated players, links LFG, and pings them", () => {
    const gather = sampleGather();
    gather.interestMessageId = "panel-9";
    const post = GatherStartGame.buildCreatePost(
      gather,
      [
        { userId: "a", displayName: "Ann" },
        { userId: "b", displayName: "Bob" },
      ],
      ["BGG lists a minimum of 3 players; you seated 2."]
    );
    expect(post.content).toContain("**Wingspan** is on the table.");
    expect(post.content).toContain("Seated: <@a> <@b>");
    expect(post.content).toContain("Host: <@host-1>");
    expect(post.content).toContain(
      "https://discord.com/channels/guild-1/lfg-channel/panel-9"
    );
    expect(post.content).toContain("/game help");
    expect(post.content).toContain("minimum of 3");
    expect(post.allowedMentions.users).toEqual(["host-1", "a", "b"]);
  });

  test("thread names truncate to Discord's 100-character limit", () => {
    const name = GatherStartGame.threadNameFromGame(`${"A".repeat(120)}\nB`);
    expect(name.length).toBe(100);
    expect(name).not.toContain("\n");
  });
});

function createThreadEnv({
  gather,
  pinThrows = null,
  failGameSave = false,
  failThreadCreate = false,
  failCreatePostTimes = 0,
  failGatherSaves = 0,
  parentType = ChannelType.GuildText,
} = {}) {
  const threadSends = [];
  const deleted = [];
  const renamed = [];
  const created = [];
  let nextMessageId = 1;
  let createPostFailuresLeft = failCreatePostTimes;
  let gatherFailuresLeft = failGatherSaves;

  const thread = {
    id: "thread-1",
    name: "Wingspan",
    guildId: "guild-1",
    send: async (payload) => {
      const content =
        typeof payload === "string" ? payload : payload?.content || "";
      if (
        String(content).includes("is on the table.") &&
        createPostFailuresLeft > 0
      ) {
        createPostFailuresLeft--;
        throw new Error("Missing Permissions");
      }
      const message = {
        id: `msg-${nextMessageId++}`,
        payload,
        pinned: false,
        pin: async () => {
          if (pinThrows) throw pinThrows;
          message.pinned = true;
        },
      };
      threadSends.push({ payload, id: message.id });
      return message;
    },
    delete: async () => {
      deleted.push(thread.id);
    },
    setName: async (name) => {
      renamed.push(name);
      thread.name = name;
    },
  };

  const parent = {
    id: "games-channel",
    type: parentType,
    guildId: "guild-1",
    isThread: () => false,
    threads: {
      create: async (opts) => {
        created.push(opts);
        if (failThreadCreate) {
          throw new Error("Missing Permissions");
        }
        return thread;
      },
    },
  };

  const lfgChannel = {
    id: "lfg-channel",
    type: ChannelType.GuildText,
    guildId: "guild-1",
    isThread: () => false,
    threads: {
      create: async () => {
        throw new Error("should not create a thread under LFG");
      },
    },
  };

  const client = memoryClient({
    [`${gather.guildId}:${GatherInterest.COLLECTION}:${gather.id}`]: gather,
  });
  if (failGameSave || failGatherSaves) {
    const original = client.setGameDataV2;
    client.setGameDataV2 = async (guildId, collection, id, data, options) => {
      if (failGameSave && collection === "game") {
        throw new Error("sqlite boom");
      }
      if (
        collection === GatherInterest.COLLECTION &&
        gatherFailuresLeft > 0
      ) {
        gatherFailuresLeft--;
        throw new Error("gather sqlite boom");
      }
      return original(guildId, collection, id, data, options);
    };
  }
  client.channels = {
    fetch: async (id) => {
      if (id === parent.id) return parent;
      if (id === lfgChannel.id) return lfgChannel;
      return null;
    },
  };

  return { client, parent, thread, threadSends, deleted, renamed, created, lfgChannel };
}

function startInteraction({ gather, client, edits, replies, values = ["a"] }) {
  const pickerMessage = {
    awaitMessageComponent: async () => ({
      user: { id: gather.hostUserId, username: "Hosty" },
      customId: GatherInterest.seatsCustomId(gather.id),
      values,
      deferUpdate: async () => {},
    }),
  };
  const interaction = {
    customId: GatherInterest.startCustomId(gather.id),
    guildId: gather.guildId,
    guild: { id: gather.guildId },
    user: { id: gather.hostUserId, username: "Hosty" },
    member: { displayName: "Hosty" },
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
      return pickerMessage;
    },
    editReply: async (payload) => {
      replies.push(payload);
      return pickerMessage;
    },
  };
  return interaction;
}

describe("GatherStartGame start flow", () => {
  let gather;

  beforeEach(() => {
    gather = sampleGather();
    gather.interestMessageId = "panel-1";
    addInterest(gather, "a", "very", "Ann", new Date("2026-09-07T12:01:00Z"));
    addInterest(gather, "b", "somewhat", "Bob", new Date("2026-09-07T12:02:00Z"));
    addInterest(gather, "c", "flexible", "Casey", new Date("2026-09-07T12:03:00Z"));
  });

  test("Start refuses clearly when the games parent channel is unset", async () => {
    const client = memoryClient(
      { [`${gather.guildId}:${GatherInterest.COLLECTION}:${gather.id}`]: gather },
      {}
    );
    const edits = [];
    const replies = [];
    await GatherInterest.handleButton(
      startInteraction({ gather, client, edits, replies }),
      client
    );
    expect(replies[0].content).toContain("/config games-channel");
    expect(edits).toHaveLength(0);
    const stored = await client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.status).toBe("open");
  });

  test("Start refuses non-hosts and empty rosters", async () => {
    const { client } = createThreadEnv({ gather });
    const edits = [];
    const replies = [];
    await GatherInterest.handleButton(
      {
        ...startInteraction({ gather, client, edits, replies }),
        user: { id: "intruder", username: "Nope" },
      },
      client
    );
    expect(replies[0].content).toBe("Only the host can start the game.");

    const empty = sampleGather();
    await client.setGameDataV2(
      empty.guildId,
      GatherInterest.COLLECTION,
      empty.id,
      empty
    );
    const emptyReplies = [];
    await GatherInterest.handleButton(
      startInteraction({
        gather: empty,
        client,
        edits: [],
        replies: emptyReplies,
      }),
      client
    );
    expect(emptyReplies[0].content).toContain("No one has registered interest");
  });

  test("host picks seats, thread is created in the games channel, status is first, create post is second", async () => {
    const env = createThreadEnv({ gather });
    const edits = [];
    const replies = [];
    const interaction = startInteraction({
      gather,
      client: env.client,
      edits,
      replies,
      values: ["a", "b"],
    });

    const pinOrder = [];
    await GatherStartGame.promptAndStart(interaction, env.client, gather, {
      shuffle: (players) => players,
      upsertPinnedStatus: async (thread, client, pinInteraction, gameData) => {
        pinOrder.push("status");
        expect(thread.id).toBe("thread-1");
        expect(pinInteraction.channelId).toBe("thread-1");
        const sent = await thread.send({ content: "📌 Live game status" });
        gameData.pinnedStatusMessageId = sent.id;
        gameData.pinnedStatusChannelId = thread.id;
        await sent.pin();
        gameData.pinnedStatusPinned = true;
      },
    });

    expect(env.created).toHaveLength(1);
    expect(env.created[0].name).toBe("Wingspan");
    expect(env.parent.id).toBe("games-channel");
    expect(env.threadSends[0].payload.content).toContain("Live game status");
    expect(env.threadSends[1].payload.content).toContain("**Wingspan** is on the table.");
    expect(env.threadSends[1].payload.content).toContain("Seated: <@a> <@b>");
    expect(env.threadSends[1].payload.content).toContain("lfg-channel");
    expect(pinOrder).toEqual(["status"]);

    const game = await env.client.getGameDataV2(gather.guildId, "game", "thread-1");
    expect(game.isdeleted).toBe(false);
    expect(game.bggGameId).toBe("266192");
    expect(game.pinnedStatusMode).toBe("on");
    expect(game.pinnedStatusMessageId).toBe("msg-1");
    expect(game.players.map((p) => p.userId)).toEqual(["a", "b"]);

    const stored = await env.client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.status).toBe("started");
    expect(stored.startedThreadId).toBe("thread-1");
    expect(stored.startedGameId).toBe("thread-1");
    expect(stored.seatedUserIds).toEqual(["a", "b"]);

    expect(edits[0].embeds[0].data.title).toContain("started");
    expect(edits[0].components[0].components.every((c) => c.data.disabled)).toBe(true);
    expect(replies.some((r) => String(r.content || "").includes("<#thread-1>"))).toBe(
      true
    );
  });

  test("second Start on the same gather is refused", async () => {
    const env = createThreadEnv({ gather });
    GatherInterest.markStarted(gather, {
      threadId: "thread-1",
      gameId: "thread-1",
      seatedUserIds: ["a"],
    });
    await env.client.setGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id,
      gather
    );
    const replies = [];
    await GatherInterest.handleButton(
      startInteraction({ gather, client: env.client, edits: [], replies }),
      env.client
    );
    expect(replies[0].content).toContain("already started");
    expect(env.created).toHaveLength(0);
  });

  test("Close without starting still freezes the roster", async () => {
    const env = createThreadEnv({ gather });
    const edits = [];
    const replies = [];
    const interaction = {
      customId: GatherInterest.closeCustomId(gather.id),
      guildId: gather.guildId,
      user: { id: "host-1", username: "Hosty" },
      member: { displayName: "Hosty" },
      deferred: false,
      replied: false,
      message: { edit: async (payload) => edits.push(payload) },
      deferReply: async () => {
        interaction.deferred = true;
      },
      reply: async (payload) => {
        interaction.replied = true;
        replies.push(payload);
      },
      editReply: async (payload) => replies.push(payload),
    };
    await GatherInterest.handleButton(interaction, env.client);
    expect(replies[0].content).toContain("Interest closed");
    const stored = await env.client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.status).toBe("closed");
    expect(stored.startedThreadId).toBeNull();
    expect(env.created).toHaveLength(0);
  });

  test("game save failure after thread create deletes the thread and does not start the gather", async () => {
    const env = createThreadEnv({ gather, failGameSave: true });
    const replies = [];
    const interaction = startInteraction({
      gather,
      client: env.client,
      edits: [],
      replies,
      values: ["a"],
    });
    await GatherStartGame.promptAndStart(interaction, env.client, gather, {
      shuffle: (players) => players,
      upsertPinnedStatus: async () => {
        throw new Error("should not pin if save failed");
      },
    });
    expect(env.created).toHaveLength(1);
    expect(env.deleted).toEqual(["thread-1"]);
    expect(replies.some((r) => String(r.content || "").includes("cleaned up") || String(r.content || "").includes("try again") || String(r.content || "").includes("Could not start"))).toBe(true);
    const stored = await env.client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.status).toBe("open");
    expect(stored.startedThreadId).toBeNull();
  });

  test("pin failure still posts status text and continues the start", async () => {
    const env = createThreadEnv({
      gather,
      pinThrows: Object.assign(new Error("Missing Permissions"), { code: 50013 }),
    });
    const replies = [];
    const interaction = startInteraction({
      gather,
      client: env.client,
      edits: [],
      replies,
      values: ["a"],
    });
    const logs = [];
    env.client.logger = { log: (msg) => logs.push(String(msg)) };

    await GatherStartGame.promptAndStart(interaction, env.client, gather, {
      shuffle: (players) => players,
      upsertPinnedStatus: async (thread, client, pinInteraction, gameData) => {
        const sent = await thread.send({ content: "📌 Live game status" });
        gameData.pinnedStatusMessageId = sent.id;
        gameData.pinnedStatusChannelId = thread.id;
        try {
          await sent.pin();
          gameData.pinnedStatusPinned = true;
        } catch (error) {
          console.error("Failed to pin live game status message.", error);
          gameData.pinnedStatusPinned = false;
        }
      },
    });

    expect(env.deleted).toEqual([]);
    expect(env.threadSends[0].payload.content).toContain("Live game status");
    expect(env.threadSends[1].payload.content).toContain("on the table");
    const game = await env.client.getGameDataV2(gather.guildId, "game", "thread-1");
    expect(game.pinnedStatusPinned).toBe(false);
    expect(game.pinnedStatusMessageId).toBe("msg-1");
    const stored = await env.client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.status).toBe("started");
  });

  test("host can start from a closed gather", async () => {
    GatherInterest.setStatus(gather, "closed");
    const env = createThreadEnv({ gather });
    await env.client.setGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id,
      gather
    );
    const replies = [];
    const interaction = startInteraction({
      gather,
      client: env.client,
      edits: [],
      replies,
      values: ["c"],
    });
    await GatherStartGame.promptAndStart(interaction, env.client, gather, {
      shuffle: (players) => players,
      upsertPinnedStatus: async (thread, client, pinInteraction, gameData) => {
        const sent = await thread.send({ content: "📌 Live game status" });
        gameData.pinnedStatusMessageId = sent.id;
        gameData.pinnedStatusChannelId = thread.id;
        gameData.pinnedStatusPinned = true;
      },
    });
    const stored = await env.client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.status).toBe("started");
    expect(stored.seatedUserIds).toEqual(["c"]);
  });

  test("warns when seating below BGG min", async () => {
    gather.game.minPlayers = 3;
    gather.game.maxPlayers = 5;
    const env = createThreadEnv({ gather });
    await env.client.setGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id,
      gather
    );
    const replies = [];
    const interaction = startInteraction({
      gather,
      client: env.client,
      edits: [],
      replies,
      values: ["a", "b"],
    });
    await GatherStartGame.promptAndStart(interaction, env.client, gather, {
      shuffle: (players) => players,
      upsertPinnedStatus: async (thread, client, pinInteraction, gameData) => {
        const sent = await thread.send({ content: "📌 Live game status" });
        gameData.pinnedStatusMessageId = sent.id;
        gameData.pinnedStatusChannelId = thread.id;
        gameData.pinnedStatusPinned = true;
      },
    });
    const hostReply = replies.find((r) => String(r.content || "").includes("Game started"));
    expect(hostReply.content).toContain("minimum of 3");
    expect(env.threadSends[1].payload.content).toContain("minimum of 3");
  });

  test("warns when seating above BGG max instead of blocking the select", async () => {
    gather.game.minPlayers = 1;
    gather.game.maxPlayers = 2;
    const env = createThreadEnv({ gather });
    await env.client.setGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id,
      gather
    );
    const replies = [];
    const interaction = startInteraction({
      gather,
      client: env.client,
      edits: [],
      replies,
      values: ["a", "b", "c"],
    });
    await GatherStartGame.promptAndStart(interaction, env.client, gather, {
      shuffle: (players) => players,
      upsertPinnedStatus: async (thread, client, pinInteraction, gameData) => {
        const sent = await thread.send({ content: "📌 Live game status" });
        gameData.pinnedStatusMessageId = sent.id;
        gameData.pinnedStatusChannelId = thread.id;
        gameData.pinnedStatusPinned = true;
      },
    });
    const hostReply = replies.find((r) =>
      String(r.content || "").includes("Game started")
    );
    expect(hostReply.content).toContain("maximum of 2");
    expect(env.threadSends[1].payload.content).toContain("maximum of 2");
  });

  test("create-post failure is an error, keeps the table, and marks the gather started", async () => {
    const env = createThreadEnv({ gather, failCreatePostTimes: 2 });
    const replies = [];
    const interaction = startInteraction({
      gather,
      client: env.client,
      edits: [],
      replies,
      values: ["a"],
    });
    await GatherStartGame.promptAndStart(interaction, env.client, gather, {
      shuffle: (players) => players,
      upsertPinnedStatus: async (thread, client, pinInteraction, gameData) => {
        const sent = await thread.send({ content: "📌 Live game status" });
        gameData.pinnedStatusMessageId = sent.id;
        gameData.pinnedStatusChannelId = thread.id;
        gameData.pinnedStatusPinned = true;
      },
    });
    expect(env.deleted).toEqual([]);
    expect(env.threadSends.some((s) => String(s.payload?.content || "").includes("on the table"))).toBe(
      false
    );
    expect(
      replies.some((r) => String(r.content || "").includes("Game started"))
    ).toBe(false);
    expect(
      replies.some((r) =>
        String(r.content || "").includes("couldn't post the table announcement")
      )
    ).toBe(true);
    const stored = await env.client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.status).toBe("started");
    expect(stored.startedThreadId).toBe("thread-1");
    const game = await env.client.getGameDataV2(gather.guildId, "game", "thread-1");
    expect(game.isdeleted).toBe(false);

    const secondReplies = [];
    await GatherInterest.handleButton(
      startInteraction({
        gather,
        client: env.client,
        edits: [],
        replies: secondReplies,
      }),
      env.client
    );
    expect(secondReplies[0].content).toContain("already started");
    expect(env.created).toHaveLength(1);
  });

  test("create-post succeeds on retry", async () => {
    const env = createThreadEnv({ gather, failCreatePostTimes: 1 });
    const replies = [];
    const interaction = startInteraction({
      gather,
      client: env.client,
      edits: [],
      replies,
      values: ["a"],
    });
    await GatherStartGame.promptAndStart(interaction, env.client, gather, {
      shuffle: (players) => players,
      upsertPinnedStatus: async (thread, client, pinInteraction, gameData) => {
        const sent = await thread.send({ content: "📌 Live game status" });
        gameData.pinnedStatusMessageId = sent.id;
        gameData.pinnedStatusChannelId = thread.id;
        gameData.pinnedStatusPinned = true;
      },
    });
    expect(env.deleted).toEqual([]);
    expect(env.threadSends[1].payload.content).toContain("on the table");
    expect(
      replies.some((r) => String(r.content || "").includes("Game started"))
    ).toBe(true);
    const stored = await env.client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.status).toBe("started");
  });

  test("gather save failure after status still marks started on retry and refuses a second Start", async () => {
    const env = createThreadEnv({ gather, failGatherSaves: 1 });
    const replies = [];
    const interaction = startInteraction({
      gather,
      client: env.client,
      edits: [],
      replies,
      values: ["a"],
    });
    await GatherStartGame.promptAndStart(interaction, env.client, gather, {
      shuffle: (players) => players,
      upsertPinnedStatus: async (thread, client, pinInteraction, gameData) => {
        const sent = await thread.send({ content: "📌 Live game status" });
        gameData.pinnedStatusMessageId = sent.id;
        gameData.pinnedStatusChannelId = thread.id;
        gameData.pinnedStatusPinned = true;
      },
    });
    expect(env.deleted).toEqual([]);
    const stored = await env.client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.status).toBe("started");
    expect(stored.startedThreadId).toBe("thread-1");
    expect(
      replies.some((r) => String(r.content || "").includes("Game started"))
    ).toBe(true);

    const secondReplies = [];
    await GatherInterest.handleButton(
      startInteraction({
        gather,
        client: env.client,
        edits: [],
        replies: secondReplies,
      }),
      env.client
    );
    expect(secondReplies[0].content).toContain("already started");
    expect(env.created).toHaveLength(1);
  });

  test("status post then gather-save outage keeps the table and still persists started", async () => {
    // persistGatherStarted tries twice per call; createGameInThread calls it
    // after status, again after the announcement, and once more in catch.
    const env = createThreadEnv({ gather, failGatherSaves: 2 });
    const replies = [];
    const interaction = startInteraction({
      gather,
      client: env.client,
      edits: [],
      replies,
      values: ["a"],
    });
    await GatherStartGame.promptAndStart(interaction, env.client, gather, {
      shuffle: (players) => players,
      upsertPinnedStatus: async (thread, client, pinInteraction, gameData) => {
        const sent = await thread.send({ content: "📌 Live game status" });
        gameData.pinnedStatusMessageId = sent.id;
        gameData.pinnedStatusChannelId = thread.id;
        gameData.pinnedStatusPinned = true;
      },
    });
    expect(env.deleted).toEqual([]);
    expect(env.threadSends[1].payload.content).toContain("on the table");
    const stored = await env.client.getGameDataV2(
      gather.guildId,
      GatherInterest.COLLECTION,
      gather.id
    );
    expect(stored.status).toBe("started");
    expect(env.created).toHaveLength(1);
  });

  test("forum parents are refused before a thread is created", () => {
    expect(
      GatherStartGame.parentChannelError({
        type: ChannelType.GuildForum,
        threads: { create: async () => ({}) },
        isThread: () => false,
      })
    ).toContain("text channel");
  });
});
